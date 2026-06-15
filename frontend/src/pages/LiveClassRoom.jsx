import { useContext, useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import VideoStream from '../components/VideoStream';
import Whiteboard from '../components/Whiteboard';
import ChatBox from '../components/ChatBox';
import PdfPresentationViewer from '../components/PdfPresentationViewer';
import './LiveClassRoom.css';

const DEFAULT_PDF_PRESENTATION_STATE = {
  scrollRatio: 0,
};

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
  const [broadcastedPpt, setBroadcastedPpt] = useState(null);
  const [pdfPresentationState, setPdfPresentationState] = useState(DEFAULT_PDF_PRESENTATION_STATE);

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
        socket?.emit('ppt-broadcast-stop', classId);
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
      setPdfPresentationState(material.presentationState || DEFAULT_PDF_PRESENTATION_STATE);
      setClassMaterials((current) => {
        if (current.some((item) => item.url === material.url)) return current;
        return [...current, material];
      });
    };
    const handlePptBroadcastStopped = () => {
      setBroadcastedPpt(null);
      setPdfPresentationState(DEFAULT_PDF_PRESENTATION_STATE);
    };
    const handlePdfPresentationState = (presentationState) => {
      setPdfPresentationState(presentationState || DEFAULT_PDF_PRESENTATION_STATE);
    };

    socket.on('ppt-broadcasted', handlePptBroadcast);
    socket.on('ppt-broadcast-stopped', handlePptBroadcastStopped);
    socket.on('pdf-presentation-state', handlePdfPresentationState);

    return () => {
      socket.off('whiteboard-snapshot-saved', handleMaterialSaved);
      socket.off('whiteboard-notes-generated', handleMaterialSaved);
      socket.off('ppt-broadcasted', handlePptBroadcast);
      socket.off('ppt-broadcast-stopped', handlePptBroadcastStopped);
      socket.off('pdf-presentation-state', handlePdfPresentationState);
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

  const handleUploadPpt = async (fileToUpload) => {
    const file = fileToUpload instanceof File ? fileToUpload : pptFile;
    if (!isTeacher || !file || uploadingPpt) return;

    setUploadingPpt(true);
    setPptError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(`/api/upload/material/${classId}`, formData);

      if (res.data.success) {
        const material = res.data.material;
        setClassMaterials((current) => [...current, material]);
        presentMaterial(material);
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

  const isPdfMaterial = (material) => (
    material?.fileType === 'pdf'
    || material?.fileType === 'whiteboard-notes-pdf'
    || material?.filename?.toLowerCase().endsWith('.pdf')
  );

  const isOfficeMaterial = (material) => (
    material?.fileType === 'ppt'
    || material?.filename?.toLowerCase().endsWith('.ppt')
    || material?.filename?.toLowerCase().endsWith('.pptx')
  );

  const getViewerUrl = (material) => {
    if (!material?.url) return null;
    if (isPdfMaterial(material)) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(material.url)}&embedded=true`;
    }
    if (isOfficeMaterial(material)) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(material.url)}`;
    }
    return null;
  };

  const presentMaterial = (material) => {
    if (!material || (!isPdfMaterial(material) && !getViewerUrl(material))) return;
    const broadcastMaterial = {
      ...material,
      presentationState: DEFAULT_PDF_PRESENTATION_STATE,
    };
    setBroadcastedPpt(broadcastMaterial);
    setPdfPresentationState(DEFAULT_PDF_PRESENTATION_STATE);
    socket?.emit('ppt-broadcast', classId, broadcastMaterial);
  };

  const stopBroadcast = () => {
    setBroadcastedPpt(null);
    setPdfPresentationState(DEFAULT_PDF_PRESENTATION_STATE);
    socket?.emit('ppt-broadcast-stop', classId);
  };

  const whiteboardSnapshots = classMaterials.filter((material) => material.fileType === 'whiteboard-snapshot');
  const notesPdfs = classMaterials.filter((material) => material.fileType === 'whiteboard-notes-pdf');
  const slideMaterials = classMaterials.filter((material) => (
    material.fileType === 'pdf' || material.fileType === 'ppt' || isOfficeMaterial(material)
  ));
  const shouldShowMaterials = whiteboardSnapshots.length > 0 || notesPdfs.length > 0 || slideMaterials.length > 0 || isTeacher;
  const broadcastViewerUrl = getViewerUrl(broadcastedPpt);
  const isBroadcastPdf = isPdfMaterial(broadcastedPpt);
  const isBroadcastOffice = isOfficeMaterial(broadcastedPpt);

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
        <div className="header-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isTeacher && (
            <>
              {/* Hidden file input for PPT broadcast */}
              <input
                id="ppt-upload-input"
                type="file"
                accept=".pdf,.ppt,.pptx"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPptFile(file);
                    handleUploadPpt(file);
                  }
                }}
              />
              <button
                className="btn-primary btn-sm"
                onClick={() => document.getElementById('ppt-upload-input').click()}
                disabled={uploadingPpt}
              >
                {uploadingPpt ? 'Broadcasting...' : 'Broadcast Slides'}
              </button>

              <button
                className="btn-primary btn-sm generate-notes-btn"
                onClick={handleGenerateNotesPdf}
                disabled={isGeneratingNotes || whiteboardSnapshots.length === 0}
              >
                {isGeneratingNotes ? 'Generating PDF...' : 'Save & Download PDF'}
              </button>
            </>
          )}
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
          {broadcastedPpt ? (
            <section className="broadcast-viewer-container glass-panel" aria-label="Teacher broadcasted slides">
              <div className="materials-heading">
                <h3>Live Presentation</h3>
                <div className="materials-heading-actions">
                  <span className="broadcast-filename">{broadcastedPpt.filename || 'Live Slides'}</span>
                  {isTeacher && (
                    <button
                      className="btn-stop-broadcast"
                      onClick={stopBroadcast}
                      title="Stop broadcast and return to whiteboard"
                    >
                      Stop
                    </button>
                  )}
                </div>
              </div>
              {isBroadcastPdf ? (
                <PdfPresentationViewer
                  material={broadcastedPpt}
                  isTeacher={isTeacher}
                  roomId={classId}
                  socket={socket}
                  presentationState={pdfPresentationState}
                />
              ) : isBroadcastOffice ? (
                <iframe
                  title="Broadcasted PPT"
                  src={broadcastViewerUrl}
                  className="broadcast-iframe"
                  allow="fullscreen"
                />
              ) : (
                <div className="broadcast-file-fallback">
                  <p>Live slide broadcast is available.</p>
                  <a
                    href={broadcastedPpt.url}
                    target="_blank"
                    rel="noreferrer"
                    className="notes-download-link"
                  >
                    Open file directly
                  </a>
                </div>
              )}
            </section>
          ) : (
            <Whiteboard
              socket={socket}
              roomId={classId}
              isTeacher={isTeacher}
              onSnapshotSaved={handleSnapshotSaved}
            />
          )}

          {isTeacher && (pptError || broadcastedPpt || slideMaterials.length > 0) && (
            <section className="class-materials-panel glass-panel" aria-label="Broadcast slides status">
              <div className="materials-heading">
                <h3>Slides</h3>
              </div>
              {pptError && <div className="materials-error" style={{ marginTop: 8 }}>{pptError}</div>}
              {broadcastedPpt && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>Currently presenting:</p>
                  <button
                    type="button"
                    className="notes-download-link material-action-link is-active"
                    style={{ marginTop: 6 }}
                    onClick={() => presentMaterial(broadcastedPpt)}
                  >
                    <span>{broadcastedPpt.fileType?.toUpperCase() || 'FILE'}</span>
                    {broadcastedPpt.filename || 'Broadcast file'}
                  </button>
                </div>
              )}
              {slideMaterials.length > 0 && (
                <div className="notes-download-list" style={{ marginTop: 12 }}>
                  {slideMaterials.map((material, index) => (
                    <button
                      key={material.publicId || material.url || index}
                      type="button"
                      className="notes-download-link material-action-link"
                      onClick={() => presentMaterial(material)}
                    >
                      <span>{material.fileType?.toUpperCase() || 'FILE'}</span>
                      {material.filename || `Slides ${index + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {!isTeacher && broadcastedPpt && (
            <section className="class-materials-panel glass-panel" aria-label="Shared slides">
              <div className="materials-heading">
                <h3>Slides from Teacher</h3>
              </div>
              <button
                type="button"
                className="notes-download-link material-action-link is-active"
                onClick={() => setBroadcastedPpt(broadcastedPpt)}
              >
                <span>{broadcastedPpt.fileType?.toUpperCase() || 'FILE'}</span>
                {broadcastedPpt.filename || 'Class slides'}
              </button>
            </section>
          )}

          {shouldShowMaterials && (
            <section className="class-materials-panel glass-panel" aria-label="Saved whiteboards">
              <div className="materials-heading">
                <h3>Class notes</h3>
                <span>{whiteboardSnapshots.length}</span>
              </div>
              {isTeacher && whiteboardSnapshots.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>
                  Save at least one whiteboard snapshot first.
                </p>
              )}
              {materialsError && <div className="materials-error">{materialsError}</div>}
              {notesPdfs.length > 0 && (
                <div className="notes-download-list">
                  {notesPdfs.map((material, index) => (
                    <a
                      key={material.publicId || material.url || index}
                      className="notes-download-link"
                      href={getViewerUrl(material) || material.url}
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
