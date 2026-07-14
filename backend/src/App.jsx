import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Import Pages
import LandingPage from './pages/LandingPage';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import LiveClassRoom from './pages/LiveClassRoom';
import TestRoom from './pages/TestRoom';
import ParticleButtonDemo from './pages/ParticleButtonDemo';

const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/class/:classId" element={<LiveClassRoom />} />
            <Route path="/test/:testId" element={<TestRoom />} />
            <Route path="/particle-button" element={<ParticleButtonDemo />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
