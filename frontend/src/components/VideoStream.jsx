import { useEffect, useMemo, useRef, useState } from 'react';
import './VideoStream.css';

const VideoStream = ({ socket, roomId, isTeacher, user, topic = 'Live Class' }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null); // Simple star topology: student sees teacher here. Teacher doesn't see students.
  
  // To keep it simple for this MVP, the teacher broadcasts video, students receive.
  const [streamStarted, setStreamStarted] = useState(false);
  const [error, setError] = useState('');

  const servers = useMemo(() => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      ...(import.meta.env.VITE_TURN_SERVER_URL ? [{
        urls: import.meta.env.VITE_TURN_SERVER_URL.split(','),
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL
      }] : [])
    ]
  }), []);

  // Maps student socketId to their RTCPeerConnection (For Teacher)
  const peerConnectionsRef = useRef({}); 
  const localStreamRef = useRef(null);
  const teacherSocketIdRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    // STUDENT LOGIC
    if (!isTeacher) {
      const pc = new RTCPeerConnection(servers);
      
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setStreamStarted(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && teacherSocketIdRef.current) {
          // Send candidate to teacher
          socket.emit('ice-candidate', {
            targetSocketId: teacherSocketIdRef.current,
            candidate: event.candidate,
            senderId: user?.id
          });
        }
      };
      // Handle incoming offer from teacher
      socket.on('offer', async (data) => {
        teacherSocketIdRef.current = data.callerSocketId;
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', {
          targetSocketId: data.callerSocketId,
          sdp: pc.localDescription,
          answererId: user?.id
        });
      });

      socket.on('ice-candidate', async (data) => {
        if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      });
      
      // When a student connects, notify teacher to send offer
      socket.emit('join-room', roomId, user?.id, user?.name, user?.role);
    }

    // TEACHER LOGIC
    if (isTeacher) {
      const startTeacherStream = async () => {
        try {
          let stream;
          try {
            // Try to get both video and audio
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch (mediaErr) {
            console.warn('Could not acquire both video and audio. Trying fallback...', mediaErr);
            try {
              // Try video only
              stream = await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (videoErr) {
              try {
                // Try audio only
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              } catch (audioErr) {
                throw new Error('Neither video nor audio devices could be accessed.');
              }
            }
          }

          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setStreamStarted(true);
          
          socket.emit('join-room', roomId, user?.id, user?.name, user?.role);
          
          // Broadcast that stream has started so dashboards update
          socket.emit('stream-started', { classId: roomId, teacherName: user?.name, topic });

        } catch (err) {
          setError(err.message || 'Camera/Microphone permission denied.');
          console.error(err);
        }
      };

      startTeacherStream();

      // Handle student joining - Teacher creates offer for this new student
      socket.on('user-connected', async (data) => {
        if (data.role === 'student') {
          const pc = new RTCPeerConnection(servers);
          peerConnectionsRef.current[data.socketId] = pc;

          // Add local tracks to this student's connection
          localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current);
          });

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('ice-candidate', {
                targetSocketId: data.socketId,
                candidate: event.candidate,
                senderId: user?.id
              });
            }
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit('offer', {
            targetSocketId: data.socketId,
            sdp: pc.localDescription,
            callerId: user?.id
          });
        }
      });

      socket.on('answer', async (data) => {
        const pc = peerConnectionsRef.current[data.answererSocketId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
      });

      socket.on('ice-candidate', async (data) => {
        const pc = peerConnectionsRef.current[data.senderSocketId];
        if (pc && data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      });

      socket.on('user-disconnected', (data) => {
        if (peerConnectionsRef.current[data.socketId]) {
          peerConnectionsRef.current[data.socketId].close();
          delete peerConnectionsRef.current[data.socketId];
        }
      });
    }

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-connected');
      socket.off('user-disconnected');
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [socket, isTeacher, roomId, user, topic, servers]);

  return (
    <div className="video-container glass-panel">
      {error && <div className="error-message">{error}</div>}
      
      {!streamStarted && !error && (
        <div className="video-placeholder">
          <div className="spinner"></div>
          <p>{isTeacher ? 'Starting stream...' : 'Waiting for teacher to start stream...'}</p>
        </div>
      )}

      {isTeacher ? (
        <video 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          muted 
          className="main-video teacher-view"
        />
      ) : (
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="main-video student-view"
        />
      )}
      
      {streamStarted && (
        <div className="live-indicator">
          <span className="dot"></span> LIVE
        </div>
      )}
    </div>
  );
};

export default VideoStream;
