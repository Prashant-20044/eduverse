import { useContext, useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import VideoStream from '../components/VideoStream';
import Whiteboard from '../components/Whiteboard';
import ChatBox from '../components/ChatBox';
import './LiveClassRoom.css';

const LiveClassRoom = () => {
  const { classId } = useParams();
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [classTopic, setClassTopic] = useState(location.state?.topic || 'Live Class');

  // If a teacher started this from dashboard, state will have isTeacher = true
  // Otherwise we infer from the logged in user's role
  const isTeacher = location.state?.isTeacher || user?.role === 'teacher';

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!socket || isTeacher) return;

    const handleStreamEnded = () => {
      alert('The teacher has ended this class.');
      navigate('/student', { replace: true });
    };

    socket.on('stream-ended', handleStreamEnded);

    return () => {
      socket.off('stream-ended', handleStreamEnded);
    };
  }, [socket, isTeacher, navigate]);

  const handleLeaveOrEnd = async () => {
    if (isTeacher) {
      try {
        await axios.patch(`/api/classes/${classId}/end`);
      } catch (err) {
        console.error('Failed to end class:', err);
      }
      navigate('/teacher', { replace: true });
    } else {
      navigate('/student', { replace: true });
    }
  };

  useEffect(() => {
    if (!user || location.state?.topic) return;

    const fetchClass = async () => {
      try {
        const res = await axios.get(`/api/classes/${classId}`);
        if (res.data.success) {
          setClassTopic(res.data.class.topic);
        }
      } catch (err) {
        console.error('Could not load class details:', err);
      }
    };

    fetchClass();
  }, [classId, location.state?.topic, user]);

  if (!user) return null;

  return (
    <div className="classroom-layout">
      <header className="classroom-header glass-panel">
        <div className="header-left">
          <button className="btn-outline btn-sm" onClick={handleLeaveOrEnd}>
            {isTeacher ? 'End Class' : 'Leave'}
          </button>
          <h2>{classTopic}</h2>
        </div>
        <div className="header-right">
          <span className="role-badge">{isTeacher ? 'Broadcasting' : 'Viewing'}</span>
        </div>
      </header>

      <main className="classroom-main">
        <div className="left-panel">
          <div className="video-section">
            <VideoStream socket={socket} roomId={classId} isTeacher={isTeacher} user={user} topic={classTopic} />
          </div>
          <div className="chat-section">
            <ChatBox socket={socket} roomId={classId} user={user} />
          </div>
        </div>

        <div className="right-panel">
          <Whiteboard socket={socket} roomId={classId} isTeacher={isTeacher} />
        </div>
      </main>
    </div>
  );
};

export default LiveClassRoom;
