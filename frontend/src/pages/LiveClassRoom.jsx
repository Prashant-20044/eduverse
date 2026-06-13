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
  const [classMaterials, setClassMaterials] = useState(location.state?.classData?.materials || []);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [materialsError, setMaterialsError] = useState('');
  const [uploadingPpt, setUploadingPpt] = useState(false);
  const [pptFile, setPptFile] = useState(null);
  const [pptError, setPptError] = useState('');
  const [broadcastedPpt, setBroadcastedPpt] = useState(null); // shown to students

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
    if (!user) return;

    const fetchClass = async () => {
      try {
        const res = await axios.get(`/api/classes/${classId}`);
        if (res.data.success) {
          setClassTopic(res.data.class.topic);
          setClassMaterials(res.data.class.materials || []);
        }
      } catch (err) {
        console.error('Could not load class details:', err);
      }
    };

    fetchClass();
  }, [classId, user]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleMaterialSaved = (material) => {
      setClassMaterials((current) => {
        if (current.some((item) => item.publicId === material.publicId || item.url === material.url)) {
          return current;
        }
        return [...current, material];
      });
    };

    socket.on('whiteboard-snapshot-saved', handleMaterialSaved);
    socket.on('whiteboard-notes-generated', handleMaterialSaved);

    // Listen for PPT/PDF broadcast from teacher
    const handlePptBroadcast = (material) => {
      setBroadcastedPpt(material);
      setClassMaterials((current) => {
        if (current.some((item) => item.url === material.url)) return current;
        return [...current, material];
      });
    };
    socket.on('ppt-broadcasted', handlePptBroadcast);

    return () => {
      socket.off('whiteboard-snapshot-saved', handleMaterialSaved);
      socket.off('whiteboard-notes-generated', handleMaterialSaved);
      socket.off('ppt-broadcasted', handlePptBroadcast);
    };
  }, [socket]);

  const handleSnapshotSaved = (material) => {
    setClassMaterials((current) => [...current, material]);
  };

  const handleGenerateNotesPdf = async () => {
    if (!isTeacher || isGeneratingNotes) return;

    setIsGeneratingNotes(true);
    setMaterialsError('');

    try {
      const res = await axios.post(`/api/upload/whiteboard-notes/${classId}`);
      if (res.data.success) {
        const material = res.data.material;
        setClassMaterials((current) => [...current, material]);
        socket?.emit('whiteboard-notes-generated', classId, material);

        // Auto-download the PDF in the teacher's browser
        const link = document.createElement('a');
        link.href = material.url;
        link.download = material.filename || 'whiteboard-notes.pdf';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      setMaterialsError(err.response?.data?.message || 'Could not generate PDF notes.');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleUploadPpt = async () => {
    if (!isTeacher || !pptFile || uploadingPpt) return;

    setUploadingPpt(true);
    setPptError('');

    try {
      const formData = new FormData();
      formData.append('file', pptFile);

      const res = await axios.post(`/api/upload/material/${classId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        const material = res.data.material;
        setClassMaterials((current) => [...current, material]);
        setBroadcastedPpt(material);
        // Broadcast to all students in room
        socket?.emit('ppt-broadcast', classId, material);
        setPptFile(null);
        // Reset file input
        const fileInput = document.getElementById('ppt-upload-input');
        if (fileInput) fileInput.value = '';
      }
    } catch (err) {
      setPptError(err.response?.data?.message || 'Could not upload file.');
    } finally {
      setUploadingPpt(false);
    }
  };

  const whiteboardSnapshots = classMaterials.filter((material) => material.type === 'whiteboard-snapshot');
  const notesPdfs = classMaterials.filter((material) => (
    material.type === 'whiteboard-notes-pdf' || material.type === 'pdf'
  ));
  const shouldShowMaterials = whiteboardSnapshots.length > 0 || notesPdfs.length > 0 || isTeacher;

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
          <Whiteboard
            socket={socket}
            roomId={classId}
            isTeacher={isTeacher}
            onSnapshotSaved={handleSnapshotSaved}
          />

          {/* PPT/PDF Broadcast Panel - teacher uploads, students see it live */}
          {isTeacher && (
            <section className="class-materials-panel glass-panel" aria-label="Broadcast slides">
              <div className="materials-heading">
                <h3>📤 Broadcast Slides</h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '10px' }}>
                Upload a PPT or PDF — students will see it instantly in their classroom.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  id="ppt-upload-input"
                  type="file"
                  accept=".pdf,.ppt,.pptx"
                  className="input-field"
                  style={{ flex: 1, minWidth: 0, fontSize: '0.82rem' }}
                  onChange={(e) => setPptFile(e.target.files?.[0] || null)}
                />
                <button
                  className="btn-primary"
                  onClick={handleUploadPpt}
                  disabled={!pptFile || uploadingPpt}
                  type="button"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {uploadingPpt ? 'Broadcasting...' : '📡 Broadcast'}
                </button>
              </div>
              {pptError && <div className="materials-error" style={{ marginTop: 8 }}>{pptError}</div>}
              {broadcastedPpt && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>✅ Currently Broadcasting:</p>
                  <a
                    href={broadcastedPpt.url}
                    target="_blank"
                    rel="noreferrer"
                    className="notes-download-link"
                    style={{ marginTop: 6 }}
                  >
                    <span>{broadcastedPpt.type?.toUpperCase() || 'FILE'}</span>
                    {broadcastedPpt.filename || 'Broadcast file'}
                  </a>
                </div>
              )}
            </section>
          )}

          {/* Student: Show broadcasted PPT if teacher shared one */}
          {!isTeacher && broadcastedPpt && (
            <section className="class-materials-panel glass-panel" aria-label="Shared slides">
              <div className="materials-heading">
                <h3>📎 Slides from Teacher</h3>
              </div>
              <a
                href={broadcastedPpt.url}
                target="_blank"
                rel="noreferrer"
                className="notes-download-link"
              >
                <span>{broadcastedPpt.type?.toUpperCase() || 'FILE'}</span>
                {broadcastedPpt.filename || 'Class slides'}
              </a>
            </section>
          )}

          {shouldShowMaterials && (
            <section className="class-materials-panel glass-panel" aria-label="Saved whiteboards">
              <div className="materials-heading">
                <h3>Class notes</h3>
                <span>{whiteboardSnapshots.length}</span>
              </div>
              {isTeacher && (
                <>
                  <button
                    className="btn-primary btn-full generate-notes-btn"
                    onClick={handleGenerateNotesPdf}
                    disabled={isGeneratingNotes || whiteboardSnapshots.length === 0}
                    type="button"
                  >
                    {isGeneratingNotes ? 'Generating PDF...' : '⬇️ Generate & Download PDF'}
                  </button>
                  {whiteboardSnapshots.length === 0 && (
                    <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>
                      Save at least one whiteboard snapshot first.
                    </p>
                  )}
                </>
              )}
              {materialsError && <div className="materials-error">{materialsError}</div>}
              {notesPdfs.length > 0 && (
                <div className="notes-download-list">
                  {notesPdfs.map((material, index) => (
                    <a
                      key={material.publicId || material.url || index}
                      className="notes-download-link"
                      href={material.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>PDF</span>
                      {material.filename || `Whiteboard notes ${index + 1}`}
                    </a>
                  ))}
                </div>
              )}
              <div className="materials-list">
                {whiteboardSnapshots.map((material, index) => (
                  <a
                    key={material.publicId || material.url || index}
                    className="material-link"
                    href={material.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img src={material.url} alt={material.filename || `Whiteboard snapshot ${index + 1}`} />
                    <span>{material.filename || `Snapshot ${index + 1}`}</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default LiveClassRoom;
