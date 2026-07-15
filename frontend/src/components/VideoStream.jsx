import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import axios from 'axios';
import './VideoStream.css';

const VideoStream = ({ socket, roomId, isTeacher, user, topic = 'Live Class' }) => {
  const [token, setToken] = useState(null);
  const [serverUrl, setServerUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Notify others via socket that stream started, if teacher
    if (isTeacher && socket) {
      socket.emit('stream-started', { classId: roomId, teacherId: user?.id, teacherName: user?.name, topic });
    }

    const fetchToken = async () => {
      try {
        const response = await axios.get(`/api/classes/${roomId}/livekit-token`);
        if (response.data.success) {
          setToken(response.data.token);
          setServerUrl(response.data.serverUrl);
        }
      } catch (err) {
        console.error('Failed to fetch LiveKit token:', err);
        setError('Failed to connect to media server. Ensure backend is running and keys are set.');
      }
    };
    fetchToken();
  }, [roomId, isTeacher, socket, user, topic]);

  if (error) {
    return <div className="video-container glass-panel error-message">{error}</div>;
  }

  if (!token || !serverUrl) {
    return (
      <div className="video-container glass-panel">
        <div className="video-placeholder">
          <div className="spinner"></div>
          <p>Connecting to secure media server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-container glass-panel" style={{ height: '600px' }}>
      <LiveKitRoom
        video={isTeacher} // Automatically publish video if teacher
        audio={isTeacher} // Automatically publish audio if teacher
        token={token}
        serverUrl={serverUrl}
        // Use the default LiveKit components styling
        data-lk-theme="default"
        style={{ height: '100%' }}
      >
        {/* VideoConference automatically renders all participants' video/audio */}
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
};

export default VideoStream;
