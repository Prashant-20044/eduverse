import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import './Dashboard.css';

const StudentDashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const navigate = useNavigate();
  const [activeClasses, setActiveClasses] = useState([]);
  const [tests, setTests] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [testError, setTestError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchStudentDashboard = async () => {
      try {
        const [classesRes, testsRes, materialsRes] = await Promise.all([
          axios.get('/api/classes/live'),
          axios.get('/api/tests/available'),
          axios.get('/api/classes/materials/all'),
        ]);
        if (classesRes.data.success) {
          setActiveClasses(classesRes.data.classes.map((classItem) => ({
            classId: classItem._id,
            title: classItem.topic,
            message: `${classItem.teacherId?.name || 'Teacher'} is live now`,
            topic: classItem.topic,
          })));
        }
        if (testsRes.data.success) {
          setTests(testsRes.data.tests);
        }
        if (materialsRes.data.success) {
          setMaterials(materialsRes.data.classes);
          console.log('Materials loaded:', materialsRes.data.classes);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setTestError(err.response?.data?.message || 'Could not load student dashboard.');
      }
    };

    fetchStudentDashboard();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const handleNotification = (data) => {
      if (data.teacherId && user?.teacherId && data.teacherId !== user.teacherId) {
        return;
      }

      setActiveClasses((current) => {
        if (current.some((classItem) => classItem.classId === data.classId)) {
          return current;
        }
        return [...current, data];
      });
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, user?.teacherId]);

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav glass-panel">
        <div className="nav-brand">EduVerse</div>
        <div className="nav-profile">
          <span>Student: {user?.name}</span>
          <img src={user?.avatar || '/favicon.svg'} alt="avatar" className="avatar" />
          <button className="btn-outline btn-sm" onClick={logout}>Logout</button>
        </div>
      </nav>

      <main className="dashboard-main">
        <h2 className="section-title">Live Classes</h2>

        {activeClasses.length === 0 ? (
          <div className="empty-state glass-panel">
            <p>No classes are currently live.</p>
            <p className="text-muted">When a teacher starts streaming, it will appear here.</p>
          </div>
        ) : (
          <div className="class-grid">
            {activeClasses.map((classItem) => (
              <div key={classItem.classId} className="class-card glass-panel">
                <div className="live-badge">LIVE</div>
                <h3>{classItem.topic || classItem.title}</h3>
                <p>{classItem.message}</p>
                <button
                  className="btn-primary"
                  onClick={() => navigate(`/class/${classItem.classId}`, {
                    state: { topic: classItem.topic || classItem.title, isTeacher: false },
                  })}
                >
                  Join Class
                </button>
              </div>
            ))}
          </div>
        )}

        <h2 className="section-title test-section-title">Tests</h2>

        {testError && <div className="dashboard-error">{testError}</div>}

        {tests.length === 0 ? (
          <div className="empty-state glass-panel">
            <p>No tests are available right now.</p>
            <p className="text-muted">Published tests from your teachers will appear here.</p>
          </div>
        ) : (
          <div className="class-grid">
            {tests.map((testItem) => (
              <div key={testItem._id} className="class-card glass-panel test-card">
                <div className="test-meta-row">
                  <span>{testItem.durationMinutes} min</span>
                  <span>{testItem.totalQuestions} MCQs</span>
                </div>
                <h3>{testItem.title}</h3>
                <p>{testItem.description || `${testItem.teacherId?.name || 'Teacher'} published this test.`}</p>
                {testItem.attempt?.status === 'submitted' ? (
                  <div className="submitted-test-actions">
                    <div className="score-chip">
                      Score: {testItem.attempt.score}/{testItem.attempt.totalQuestions}
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => navigate(`/test/${testItem._id}`)}
                    >
                      Retake Test
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => navigate(`/test/${testItem._id}`)}
                  >
                    {testItem.attempt ? 'Continue Test' : 'Start Test'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <h2 className="section-title test-section-title">Teacher Materials</h2>

        {materials.length === 0 ? (
          <div className="empty-state glass-panel">
            <p>No materials have been uploaded yet.</p>
            <p className="text-muted">Teachers will share slides and notes here.</p>
          </div>
        ) : (
          <div className="materials-container">
            {materials.map((classItem) => (
              <div key={classItem._id} className="materials-class-section glass-panel">
                <div className="materials-class-header">
                  <div>
                    <h3>{classItem.topic}</h3>
                    <p className="materials-teacher-name">by {classItem.teacherId?.name || 'Teacher'}</p>
                  </div>
                  <span className="materials-count-badge">{classItem.materials.length} file(s)</span>
                </div>
                <div className="materials-list">
                  {classItem.materials.map((material, index) => (
                    <a
                      key={index}
                      href={material.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="material-item"
                      title={material.filename}
                    >
                      <span className="material-icon">
                        {material.fileType === 'pdf' && '📄'}
                        {material.fileType === 'ppt' && '📊'}
                        {material.fileType === 'image' && '🖼️'}
                        {!['pdf', 'ppt', 'image'].includes(material.fileType) && '📎'}
                      </span>
                      <span className="material-filename">{material.filename}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;
