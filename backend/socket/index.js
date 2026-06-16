const whiteboardStates = new Map();
const activeBroadcasts = new Map();
const defaultPdfPresentationState = {
  scrollRatio: 0,
};

const getEmptyBoardState = () => ({
  history: [],
  boardHeight: 1600,
});

const normalizeBoardState = (payload) => {
  if (Array.isArray(payload)) {
    return {
      history: payload,
      boardHeight: 1600,
    };
  }

  return {
    history: Array.isArray(payload?.history) ? payload.history : [],
    boardHeight: Number(payload?.boardHeight) || 1600,
  };
};

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('error', (err) => {
      console.error(`Socket error for ${socket.id}:`, err);
    });

    // --- Rooms & Class Management ---
    socket.on('join-room', (roomId, userId, userName, role) => {
      console.log(`join-room event: roomId=${roomId}, userId=${userId}, userName=${userName}, role=${role}`);
      socket.join(roomId);
      console.log(`User ${userName} (${role}) joined room ${roomId}`);
      
      // Notify others in the room
      socket.to(roomId).emit('user-connected', { userId, userName, role, socketId: socket.id });

      socket.emit('sync-board', whiteboardStates.get(roomId) || getEmptyBoardState());
      const activeBroadcast = activeBroadcasts.get(roomId);
      if (activeBroadcast) {
        socket.emit('ppt-broadcasted', activeBroadcast);
      }

      socket.on('disconnect', async () => {
        console.log(`User ${userName} disconnected from room ${roomId}`);
        socket.to(roomId).emit('user-disconnected', { userId, socketId: socket.id });
        
        // If the teacher disconnects, auto-end the class in the database
        if (role === 'teacher') {
          try {
            const Class = require('../models/Class');
            await Class.findByIdAndUpdate(roomId, { status: 'ended' });
            whiteboardStates.delete(roomId);
            activeBroadcasts.delete(roomId);
            console.log(`Class ${roomId} auto-ended due to teacher disconnect.`);
            
            // Notify other clients in the room that the stream ended
            socket.to(roomId).emit('stream-ended');
          } catch (err) {
            console.error(`Error auto-ending class ${roomId}:`, err);
          }
        }
      });
    });

    // --- WebRTC Signaling (Star Topology for small groups) ---
    // Broadcaster (Teacher) sends offer to specific Viewer (Student)
    socket.on('offer', (data) => {
      console.log(`offer event from ${socket.id} to ${data.targetSocketId}`);
      socket.to(data.targetSocketId).emit('offer', {
        sdp: data.sdp,
        callerId: data.callerId,
        callerSocketId: socket.id
      });
    });

    // Viewer (Student) sends answer back to Broadcaster (Teacher)
    socket.on('answer', (data) => {
      console.log(`answer event from ${socket.id} to ${data.targetSocketId}`);
      socket.to(data.targetSocketId).emit('answer', {
        sdp: data.sdp,
        answererId: data.answererId,
        answererSocketId: socket.id
      });
    });

    // ICE Candidate Exchange
    socket.on('ice-candidate', (data) => {
      console.log(`ice-candidate event from ${socket.id} to ${data.targetSocketId}`);
      socket.to(data.targetSocketId).emit('ice-candidate', {
        candidate: data.candidate,
        senderId: data.senderId,
        senderSocketId: socket.id
      });
    });

    // --- Chat System ---
    socket.on('send-chat', (roomId, messageData) => {
      console.log(`send-chat event in room ${roomId}:`, messageData);
      // Broadcast to everyone in the room, including sender (if frontend expects it, or use .to)
      io.to(roomId).emit('receive-chat', messageData);
    });

    // --- Whiteboard Sync ---
    socket.on('draw-action', (roomId, drawData) => {
      console.log(`draw-action event in room ${roomId}`);
      // drawData contains coordinates, color, brush size, etc.
      socket.to(roomId).emit('draw-action', drawData);
    });
    
    socket.on('clear-board', (roomId) => {
      console.log(`clear-board event in room ${roomId}`);
      whiteboardStates.set(roomId, getEmptyBoardState());
      socket.to(roomId).emit('clear-board');
    });

    socket.on('sync-board', (roomId, payload) => {
      const boardState = normalizeBoardState(payload);
      whiteboardStates.set(roomId, boardState);
      socket.to(roomId).emit('sync-board', boardState);
    });

    socket.on('request-board-sync', (roomId) => {
      socket.emit('sync-board', whiteboardStates.get(roomId) || getEmptyBoardState());
    });

    socket.on('whiteboard-snapshot-saved', (roomId, material) => {
      socket.to(roomId).emit('whiteboard-snapshot-saved', material);
    });

    socket.on('whiteboard-notes-generated', (roomId, material) => {
      socket.to(roomId).emit('whiteboard-notes-generated', material);
    });

    socket.on('class-material-deleted', (roomId, material) => {
      const activeBroadcast = activeBroadcasts.get(roomId);
      const isActiveBroadcast = activeBroadcast
        && (
          (material?._id && activeBroadcast._id === material._id)
          || (material?.publicId && activeBroadcast.publicId === material.publicId)
          || (material?.url && activeBroadcast.url === material.url)
        );
      if (isActiveBroadcast) {
        activeBroadcasts.delete(roomId);
        socket.to(roomId).emit('ppt-broadcast-stopped');
      }
      socket.to(roomId).emit('class-material-deleted', material);
    });

    // --- PPT/PDF Broadcast ---
    socket.on('ppt-broadcast', (roomId, material) => {
      console.log(`ppt-broadcast event in room ${roomId}: ${material?.filename}`);
      const broadcastMaterial = {
        ...material,
        presentationState: material?.presentationState || defaultPdfPresentationState,
      };
      activeBroadcasts.set(roomId, broadcastMaterial);
      io.to(roomId).emit('ppt-broadcasted', broadcastMaterial);
    });

    socket.on('pdf-presentation-state', (roomId, presentationState) => {
      const activeBroadcast = activeBroadcasts.get(roomId);
      const nextState = {
        scrollRatio: Number(presentationState?.scrollRatio) || 0,
      };

      if (activeBroadcast) {
        activeBroadcasts.set(roomId, {
          ...activeBroadcast,
          presentationState: nextState,
        });
      }

      socket.to(roomId).emit('pdf-presentation-state', nextState);
    });

    socket.on('ppt-broadcast-stop', (roomId) => {
      console.log(`ppt-broadcast-stop event in room ${roomId}`);
      activeBroadcasts.delete(roomId);
      io.to(roomId).emit('ppt-broadcast-stopped');
    });

    // --- Notifications ---
    socket.on('stream-started', (classData) => {
      const classId = classData.classId || classData._id;
      // Broadcast to all connected clients that a new stream is live
      socket.broadcast.emit('notification', {
        title: 'Class is Live!',
        message: `${classData.teacherName} started streaming: ${classData.topic}`,
        classId,
        topic: classData.topic,
        teacherId: classData.teacherId,
        teacherName: classData.teacherName
      });
    });

  });
};
