const { getRedisClient } = require('../redisClient');

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
    const redis = getRedisClient();

    socket.on('error', (err) => {
      console.error(`Socket error for ${socket.id}:`, err);
    });

    // --- Rooms & Class Management ---
    socket.on('join-room', async (roomId, userId, userName, role) => {
      console.log(`join-room event: roomId=${roomId}, userId=${userId}, userName=${userName}, role=${role}`);
      socket.join(roomId);
      
      // Notify others in the room
      socket.to(roomId).emit('user-connected', { userId, userName, role, socketId: socket.id });

      // Fetch states from Redis instead of memory
      if (redis) {
        try {
          const rawBoard = await redis.hGet('whiteboardStates', roomId);
          socket.emit('sync-board', rawBoard ? JSON.parse(rawBoard) : getEmptyBoardState());

          const rawBroadcast = await redis.hGet('activeBroadcasts', roomId);
          if (rawBroadcast) {
            socket.emit('ppt-broadcasted', JSON.parse(rawBroadcast));
          }
        } catch (err) {
          console.error('Redis fetch error:', err);
        }
      } else {
        socket.emit('sync-board', getEmptyBoardState());
      }

      socket.on('disconnect', async () => {
        console.log(`User ${userName} disconnected from room ${roomId}`);
        socket.to(roomId).emit('user-disconnected', { userId, socketId: socket.id });
        
        // If the teacher disconnects, auto-end the class in the database
        if (role === 'teacher') {
          try {
            const Class = require('../models/Class');
            await Class.findByIdAndUpdate(roomId, { status: 'ended' });
            
            if (redis) {
              await redis.hDel('whiteboardStates', roomId);
              await redis.hDel('activeBroadcasts', roomId);
            }
            
            // Notify other clients in the room that the stream ended
            socket.to(roomId).emit('stream-ended');
          } catch (err) {
            console.error(`Error auto-ending class ${roomId}:`, err);
          }
        }
      });
    });

    // --- Chat System ---
    socket.on('send-chat', (roomId, messageData) => {
      io.to(roomId).emit('receive-chat', messageData);
    });

    // --- Whiteboard Sync ---
    socket.on('draw-action', (roomId, drawData) => {
      socket.to(roomId).emit('draw-action', drawData);
    });
    
    socket.on('clear-board', async (roomId) => {
      if (redis) {
        await redis.hSet('whiteboardStates', roomId, JSON.stringify(getEmptyBoardState()));
      }
      socket.to(roomId).emit('clear-board');
    });

    socket.on('sync-board', async (roomId, payload) => {
      const boardState = normalizeBoardState(payload);
      if (redis) {
        await redis.hSet('whiteboardStates', roomId, JSON.stringify(boardState));
      }
      socket.to(roomId).emit('sync-board', boardState);
    });

    socket.on('request-board-sync', async (roomId) => {
      if (redis) {
        const rawBoard = await redis.hGet('whiteboardStates', roomId);
        socket.emit('sync-board', rawBoard ? JSON.parse(rawBoard) : getEmptyBoardState());
      } else {
        socket.emit('sync-board', getEmptyBoardState());
      }
    });

    socket.on('whiteboard-snapshot-saved', (roomId, material) => {
      socket.to(roomId).emit('whiteboard-snapshot-saved', material);
    });

    socket.on('whiteboard-notes-generated', (roomId, material) => {
      socket.to(roomId).emit('whiteboard-notes-generated', material);
    });

    socket.on('class-material-deleted', async (roomId, material) => {
      if (redis) {
        const rawBroadcast = await redis.hGet('activeBroadcasts', roomId);
        if (rawBroadcast) {
          const activeBroadcast = JSON.parse(rawBroadcast);
          const isActiveBroadcast = activeBroadcast
            && (
              (material?._id && activeBroadcast._id === material._id)
              || (material?.publicId && activeBroadcast.publicId === material.publicId)
              || (material?.url && activeBroadcast.url === material.url)
            );
          if (isActiveBroadcast) {
            await redis.hDel('activeBroadcasts', roomId);
            socket.to(roomId).emit('ppt-broadcast-stopped');
          }
        }
      }
      socket.to(roomId).emit('class-material-deleted', material);
    });

    // --- PPT/PDF Broadcast ---
    socket.on('ppt-broadcast', async (roomId, material) => {
      const broadcastMaterial = {
        ...material,
        presentationState: material?.presentationState || defaultPdfPresentationState,
      };
      if (redis) {
        await redis.hSet('activeBroadcasts', roomId, JSON.stringify(broadcastMaterial));
      }
      io.to(roomId).emit('ppt-broadcasted', broadcastMaterial);
    });

    socket.on('pdf-presentation-state', async (roomId, presentationState) => {
      const nextState = {
        scrollRatio: Number(presentationState?.scrollRatio) || 0,
      };

      if (redis) {
        const rawBroadcast = await redis.hGet('activeBroadcasts', roomId);
        if (rawBroadcast) {
          const activeBroadcast = JSON.parse(rawBroadcast);
          activeBroadcast.presentationState = nextState;
          await redis.hSet('activeBroadcasts', roomId, JSON.stringify(activeBroadcast));
        }
      }

      socket.to(roomId).emit('pdf-presentation-state', nextState);
    });

    socket.on('ppt-broadcast-stop', async (roomId) => {
      if (redis) {
        await redis.hDel('activeBroadcasts', roomId);
      }
      io.to(roomId).emit('ppt-broadcast-stopped');
    });

    // --- Notifications ---
    socket.on('stream-started', (classData) => {
      const classId = classData.classId || classData._id;
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
