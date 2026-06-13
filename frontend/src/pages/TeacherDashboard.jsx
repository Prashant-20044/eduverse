import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import './Dashboard.css';

const API_URL = '/api';

const getDefaultScheduleTime = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 30);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
};

const formatSchedule = (value) => {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const TeacherDashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [tests, setTests] = useState([]);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduleTime);
  const [testTitle, setTestTitle] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [questionsFile, setQuestionsFile] = useState(null);
  const [answerKeyFile, setAnswerKeyFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTest, setSavingTest] = useState(false);
  const [startingNow, setStartingNow] = useState(false);
  const [startingClassId, setStartingClassId] = useState(null);
  const [error, setError] = useState('');
  const [uploadClassId, setUploadClassId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');

  const upcomingClasses = useMemo(() => {
    return classes.filter((classItem) => classItem.status !== 'ended');
  }, [classes]);

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
      return;
    }

    if (user.role !== 'teacher') {
      navigate('/student', { replace: true });
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const [classesRes, testsRes] = await Promise.all([
          axios.get(`${API_URL}/classes/teacher`),
          axios.get(`${API_URL}/tests/teacher`),
        ]);
        if (classesRes.data.success) {
          setClasses(classesRes.data.classes);
        }
        if (testsRes.data.success) {
          setTests(testsRes.data.tests);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load your dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate, user]);

  const handleScheduleClass = async (event) => {
    event.preventDefault();
    if (!topic.trim()) {
      setError('Please enter a class topic.');
      return;
    }

    const scheduledTime = new Date(scheduledAt);
    if (scheduledTime.getTime() < Date.now() - 60000) {
      setError('Cannot schedule classes in the past.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/classes`, {
        topic,
        description,
        scheduledAt,
      });

      if (res.data.success) {
        setClasses((current) => [...current, res.data.class].sort((a, b) => new Date(a.scheduledAt || a.createdAt) - new Date(b.scheduledAt || b.createdAt)));
        setTopic('');
        setDescription('');
        setScheduledAt(getDefaultScheduleTime());
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not schedule class.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartNow = async () => {
    if (!topic.trim()) {
      setError('Please enter a class topic.');
      return;
    }

    setStartingNow(true);
    setError('');

    try {
      const createRes = await axios.post(`${API_URL}/classes`, {
        topic,
        description,
        scheduledAt: new Date().toISOString(),
      });

      if (!createRes.data.success) return;

      const classObj = createRes.data.class;
      const startRes = await axios.patch(`${API_URL}/classes/${classObj._id}/start`);
      const startedClass = startRes.data.class;

      navigate(`/class/${startedClass._id}`, {
        state: {
          topic: startedClass.topic,
          isTeacher: true,
          classData: startedClass,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start this class.');
      setStartingNow(false);
    }
  };

  const handleStartClass = async (classItem) => {
    setStartingClassId(classItem._id);
    setError('');

    try {
      const res = await axios.patch(`${API_URL}/classes/${classItem._id}/start`);
      const startedClass = res.data.class;

      navigate(`/class/${startedClass._id}`, {
        state: {
          topic: startedClass.topic,
          isTeacher: true,
          classData: startedClass,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start this class.');
      setStartingClassId(null);
    }
  };

  const handleCreateTest = async (event) => {
    event.preventDefault();
    if (!testTitle.trim()) {
      setError('Please enter a test title.');
      return;
    }
    if (!questionsFile || !answerKeyFile) {
      setError('Please upload both the MCQ file and answer key file.');
      return;
    }

    setSavingTest(true);
    setError('');

    const formData = new FormData();
    formData.append('title', testTitle);
    formData.append('description', testDescription);
    formData.append('durationMinutes', durationMinutes);
    formData.append('questionsFile', questionsFile);
    formData.append('answerKeyFile', answerKeyFile);

    try {
      const res = await axios.post(`${API_URL}/tests`, formData);

      if (res.data.success) {
        setTests((current) => [res.data.test, ...current]);
        setTestTitle('');
        setTestDescription('');
        setDurationMinutes(30);
        setQuestionsFile(null);
        setAnswerKeyFile(null);
        event.target.reset();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create test.');
    } finally {
      setSavingTest(false);
    }
  };

  const handleUploadMaterial = async (event) => {
    event.preventDefault();
    if (!uploadClassId || !uploadFile) {
      setUploadError('Please select a class and a file.');
      return;
    }

    setUploadingMaterial(true);
    setUploadError('');
    setUploadSuccess('');

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await axios.post(`${API_URL}/upload/material/${uploadClassId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setUploadSuccess(`✅ "${res.data.material.filename}" uploaded successfully! Students can now access it.`);
        setUploadFile(null);
        setUploadClassId('');
        event.target.reset();
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploadingMaterial(false);
    }
  };

  return (
    <div className="dashboard-container teacher-profile-page">
      <nav className="dashboard-nav glass-panel">
        <div>
          <div className="nav-brand">EduVerse</div>
          <p className="nav-subtitle">Teacher profile dashboard</p>
        </div>
        <div className="nav-profile">
          <span>{user?.name}</span>
          <img src={user?.avatar || '/favicon.svg'} alt="avatar" className="avatar" />
          <button className="btn-outline btn-sm" onClick={logout}>Logout</button>
        </div>
      </nav>

      <main className="teacher-dashboard-main">
        <section className="teacher-profile-panel glass-panel">
          <div className="teacher-profile-card">
            <img src={user?.avatar || '/favicon.svg'} alt="teacher avatar" className="teacher-profile-avatar" />
            <div>
              <p className="eyebrow">Teacher</p>
              <h1>{user?.name}</h1>
              <p>{user?.email}</p>
            </div>
          </div>

          <div className="teacher-stats">
            <div>
              <strong>{upcomingClasses.length}</strong>
              <span>Scheduled</span>
            </div>
            <div>
              <strong>{classes.filter((classItem) => classItem.status === 'live').length}</strong>
              <span>Live now</span>
            </div>
            <div>
              <strong>{tests.length}</strong>
              <span>Tests</span>
            </div>
          </div>
        </section>

        <section className="schedule-layout">
          <div className="schedule-panel glass-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Schedule</p>
                <h2>Your classes</h2>
              </div>
            </div>

            {error && <div className="dashboard-error">{error}</div>}

            {loading ? (
              <div className="empty-state compact">Loading your schedule...</div>
            ) : upcomingClasses.length === 0 ? (
              <div className="empty-state compact">
                <p>No classes scheduled yet.</p>
                <p className="text-muted">Create your first class from the form.</p>
              </div>
            ) : (
              <div className="teacher-class-list">
                {upcomingClasses.map((classItem) => (
                  <article key={classItem._id} className="teacher-class-row">
                    <div className="class-time-block">
                      <span>{formatSchedule(classItem.scheduledAt || classItem.createdAt)}</span>
                    </div>
                    <div className="teacher-class-info">
                      <div className="class-title-line">
                        <h3>{classItem.topic}</h3>
                        <span className={`status-chip status-${classItem.status}`}>{classItem.status}</span>
                      </div>
                      {classItem.description && <p>{classItem.description}</p>}
                    </div>
                    <button
                      className="btn-primary start-class-btn"
                      onClick={() => handleStartClass(classItem)}
                      disabled={startingClassId === classItem._id}
                    >
                      {startingClassId === classItem._id ? 'Starting...' : 'Start Class'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="create-class-panel glass-panel">
            <p className="eyebrow">New class</p>
            <h2>Schedule class</h2>
            <form onSubmit={handleScheduleClass} className="class-form">
              <div className="form-group">
                <label>Topic</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Algebra foundations"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Date and time</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="input-field textarea-field"
                  placeholder="Short notes for this class"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary btn-full" disabled={saving || startingNow}>
                {saving ? 'Scheduling...' : 'Add to Schedule'}
              </button>
              <button
                type="button"
                className="btn-outline btn-full"
                onClick={handleStartNow}
                disabled={saving || startingNow}
              >
                {startingNow ? 'Starting...' : 'Start Now'}
              </button>
            </form>
          </aside>
        </section>

        <section className="schedule-layout">
          <div className="schedule-panel glass-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Resources</p>
                <h2>Upload Slides</h2>
              </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 16 }}>
              Upload a PPT or PDF to any class — students will see it in their materials panel.
            </p>

            {classes.length === 0 ? (
              <div className="empty-state compact">
                <p>Create a class first to upload materials.</p>
              </div>
            ) : (
              <form onSubmit={handleUploadMaterial} className="class-form">
                <div className="form-group">
                  <label>Select Class</label>
                  <select
                    className="input-field"
                    value={uploadClassId}
                    onChange={(e) => { setUploadClassId(e.target.value); setUploadSuccess(''); setUploadError(''); }}
                  >
                    <option value="">— choose a class —</option>
                    {classes.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.topic} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>File (PPT / PDF)</label>
                  <input
                    type="file"
                    className="input-field"
                    accept=".pdf,.ppt,.pptx"
                    onChange={(e) => { setUploadFile(e.target.files?.[0] || null); setUploadSuccess(''); setUploadError(''); }}
                  />
                </div>

                {uploadError && <div className="dashboard-error">{uploadError}</div>}
                {uploadSuccess && <div style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: 8 }}>{uploadSuccess}</div>}

                <button type="submit" className="btn-primary btn-full" disabled={uploadingMaterial}>
                  {uploadingMaterial ? 'Uploading...' : '📤 Upload to Class'}
                </button>
              </form>
            )}
          </div>

          <aside className="create-class-panel glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
            <p className="eyebrow">Pro tip</p>
            <h2 style={{ fontSize: '1.25rem' }}>Slides stay after class</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7 }}>
              Files you upload are saved permanently and accessible to all enrolled students whenever they view the class.
            </p>
          </aside>
        </section>

        <section className="tests-layout">
          <div className="schedule-panel glass-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Assessment</p>
                <h2>Your tests</h2>
              </div>
            </div>

            {loading ? (
              <div className="empty-state compact">Loading tests...</div>
            ) : tests.length === 0 ? (
              <div className="empty-state compact">
                <p>No tests created yet.</p>
                <p className="text-muted">Upload an MCQ file and answer key to publish one.</p>
              </div>
            ) : (
              <div className="teacher-class-list">
                {tests.map((testItem) => (
                  <article key={testItem._id} className="teacher-class-row test-row">
                    <div className="class-time-block">
                      <span>{testItem.durationMinutes} minutes</span>
                    </div>
                    <div className="teacher-class-info">
                      <div className="class-title-line">
                        <h3>{testItem.title}</h3>
                        <span className="status-chip">{testItem.questions?.length || 0} MCQs</span>
                      </div>
                      {testItem.description && <p>{testItem.description}</p>}
                    </div>
                    <span className="text-muted">{formatSchedule(testItem.createdAt)}</span>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="create-class-panel glass-panel">
            <p className="eyebrow">New test</p>
            <h2>Upload MCQs</h2>
            <form onSubmit={handleCreateTest} className="class-form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Physics chapter test"
                  value={testTitle}
                  onChange={(event) => setTestTitle(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Duration in minutes</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="input-field textarea-field"
                  placeholder="Short instructions for students"
                  value={testDescription}
                  onChange={(event) => setTestDescription(event.target.value)}
                />
              </div>

              <div className="form-group">
                <label>MCQ file</label>
                <input
                  type="file"
                  className="input-field"
                  accept=".json,.csv,.txt"
                  onChange={(event) => setQuestionsFile(event.target.files?.[0] || null)}
                />
                <span className="text-muted">Use: Question | Option A | Option B | Option C | Option D</span>
              </div>

              <div className="form-group">
                <label>Answer key file</label>
                <input
                  type="file"
                  className="input-field"
                  accept=".json,.csv,.txt"
                  onChange={(event) => setAnswerKeyFile(event.target.files?.[0] || null)}
                />
                <span className="text-muted">Use one answer per line, like 1:A or A.</span>
              </div>

              <button type="submit" className="btn-primary btn-full" disabled={savingTest}>
                {savingTest ? 'Publishing...' : 'Publish Test'}
              </button>
            </form>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default TeacherDashboard;
