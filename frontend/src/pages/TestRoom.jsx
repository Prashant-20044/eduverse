import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import './Dashboard.css';

const API_URL = 'http://localhost:5000/api';

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const TestRoom = () => {
  const { user } = useContext(AuthContext);
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [responses, setResponses] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    if (user.role !== 'student') {
      navigate('/teacher', { replace: true });
      return;
    }

    const startTest = async () => {
      try {
        const res = await axios.post(`${API_URL}/tests/${testId}/start`);
        if (res.data.success) {
          setTest(res.data.test);
          setAttempt(res.data.attempt);
          const expiresAt = new Date(res.data.attempt.expiresAt).getTime();
          setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
          if (res.data.attempt.status === 'submitted') {
            setResult({
              score: res.data.attempt.score,
              totalQuestions: res.data.attempt.totalQuestions,
              percentage: Math.round((res.data.attempt.score / res.data.attempt.totalQuestions) * 100),
              submittedAt: res.data.attempt.submittedAt,
            });
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Could not start this test.');
      } finally {
        setLoading(false);
      }
    };

    startTest();
  }, [navigate, testId, user]);

  const handleSubmit = useCallback(async () => {
    if (submitting || result) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/tests/${testId}/submit`, { responses });
      if (res.data.success) {
        setResult(res.data.result || {
          score: res.data.attempt.score,
          totalQuestions: res.data.attempt.totalQuestions,
          percentage: Math.round((res.data.attempt.score / res.data.attempt.totalQuestions) * 100),
          submittedAt: res.data.attempt.submittedAt,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit this test.');
    } finally {
      setSubmitting(false);
    }
  }, [responses, result, submitting, testId]);

  const handleRetake = async () => {
    if (retaking) return;

    setRetaking(true);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/tests/${testId}/retake`);
      if (res.data.success) {
        setTest(res.data.test);
        setAttempt(res.data.attempt);
        setResponses({});
        setResult(null);
        const expiresAt = new Date(res.data.attempt.expiresAt).getTime();
        setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not restart this test.');
    } finally {
      setRetaking(false);
    }
  };

  useEffect(() => {
    if (!attempt || result) return undefined;

    const timer = window.setInterval(() => {
      const nextSeconds = Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(nextSeconds);
      if (nextSeconds <= 0) {
        window.clearInterval(timer);
        handleSubmit();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [attempt, handleSubmit, result]);

  const answeredCount = useMemo(() => Object.keys(responses).length, [responses]);

  if (loading) {
    return <div className="dashboard-container"><div className="empty-state glass-panel">Loading test...</div></div>;
  }

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav glass-panel">
        <div>
          <div className="nav-brand">EduStream</div>
          <p className="nav-subtitle">Test room</p>
        </div>
        <div className="nav-profile">
          <span>{user?.name}</span>
          <button className="btn-outline btn-sm" onClick={() => navigate('/student')}>Dashboard</button>
        </div>
      </nav>

      <main className="test-room-main">
        {error && <div className="dashboard-error">{error}</div>}

        {test && (
          <>
            <section className="test-header-panel glass-panel">
              <div>
                <p className="eyebrow">MCQ test</p>
                <h1>{test.title}</h1>
                {test.description && <p>{test.description}</p>}
              </div>
              <div className={`timer-box ${remainingSeconds <= 60 && !result ? 'timer-danger' : ''}`}>
                <span>{result ? 'Submitted' : 'Time left'}</span>
                <strong>{result ? `${result.score}/${result.totalQuestions}` : formatTime(remainingSeconds)}</strong>
              </div>
            </section>

            {result ? (
              <section className="result-panel glass-panel">
                <p className="eyebrow">Score</p>
                <h2>{result.percentage}%</h2>
                <p>You scored {result.score} out of {result.totalQuestions}.</p>
                <div className="result-actions">
                  <button className="btn-primary" onClick={handleRetake} disabled={retaking}>
                    {retaking ? 'Starting...' : 'Retake Test'}
                  </button>
                  <button className="btn-outline" onClick={() => navigate('/student')}>Back to Tests</button>
                </div>
              </section>
            ) : (
              <form className="question-list" onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
                {test.questions.map((question, questionIndex) => (
                  <article className="question-card glass-panel" key={question._id}>
                    <div className="question-title">
                      <span>{questionIndex + 1}</span>
                      <h3>{question.question}</h3>
                    </div>
                    <div className="option-list">
                      {question.options.map((option, optionIndex) => (
                        <button
                          className={`option-button ${responses[question._id] === optionIndex ? 'option-selected' : ''}`}
                          key={`${question._id}-${optionIndex}`}
                          type="button"
                          aria-pressed={responses[question._id] === optionIndex}
                          onClick={() => setResponses((current) => ({ ...current, [question._id]: optionIndex }))}
                        >
                          <span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                          <span className="option-text">{option}</span>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}

                <div className="test-submit-bar glass-panel">
                  <span>{answeredCount} of {test.questions.length} answered</span>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Test'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default TestRoom;
