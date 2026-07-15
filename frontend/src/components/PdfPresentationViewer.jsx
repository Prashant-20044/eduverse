import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import './PdfPresentationViewer.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const DEFAULT_PRESENTATION_STATE = {
  scrollRatio: 0,
};

const PdfPageCanvas = ({ pdfDocument, pageNumber, width }) => {
  const canvasRef = useRef(null);
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let renderTask;

    const renderPage = async () => {
      if (!pdfDocument || !width) return;

      try {
        setRenderError('');
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = width / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (err) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          setRenderError('Could not render this PDF page.');
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDocument, pageNumber, width]);

  return (
    <div className="pdf-page-frame">
      <canvas ref={canvasRef} className="pdf-page-canvas" aria-label={`PDF page ${pageNumber}`} />
      {renderError && <p className="pdf-viewer-error">{renderError}</p>}
    </div>
  );
};

const PdfPresentationViewer = ({
  material,
  isTeacher,
  roomId,
  socket,
  presentationState = DEFAULT_PRESENTATION_STATE,
}) => {
  const scrollRef = useRef(null);
  const rafRef = useRef(null);
  const suppressScrollRef = useRef(false);
  const [documentState, setDocumentState] = useState({
    url: '',
    pdfDocument: null,
    loadError: '',
  });
  const [pageWidth, setPageWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadDocument = async () => {
      if (!material?.url) return;

      try {
        const loadingTask = pdfjsLib.getDocument({
          url: material.url,
          withCredentials: false,
        });
        const loadedPdf = await loadingTask.promise;
        if (!cancelled) {
          setDocumentState({
            url: material.url,
            pdfDocument: loadedPdf,
            loadError: '',
          });
        }
      } catch {
        if (!cancelled) {
          setDocumentState({
            url: material.url,
            pdfDocument: null,
            loadError: 'Could not load this PDF for presentation.',
          });
        }
      }
    };

    loadDocument();

    return () => {
      cancelled = true;
    };
  }, [material?.url]);

  const pdfDocument = documentState.url === material?.url ? documentState.pdfDocument : null;
  const loadError = documentState.url === material?.url ? documentState.loadError : '';

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return undefined;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.max(280, Math.floor(entry.contentRect.width - 32));
      setPageWidth(Math.min(width, 1100));
    });

    resizeObserver.observe(scrollElement);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (isTeacher || !scrollRef.current) return;

    const scrollElement = scrollRef.current;
    const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
    const nextTop = Math.max(0, maxScrollTop * (presentationState?.scrollRatio || 0));

    suppressScrollRef.current = true;
    scrollElement.scrollTop = nextTop;
    requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    });
  }, [isTeacher, presentationState?.scrollRatio, pdfDocument, pageWidth]);

  const emitTeacherViewport = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!isTeacher || !socket || !scrollElement) return;

    const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
    const scrollRatio = maxScrollTop > 0 ? scrollElement.scrollTop / maxScrollTop : 0;

    socket.emit('pdf-presentation-state', roomId, {
      scrollRatio: Number(scrollRatio.toFixed(5)),
    });
  }, [isTeacher, roomId, socket]);

  const handleScroll = () => {
    if (!isTeacher || suppressScrollRef.current) return;
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      emitTeacherViewport();
    });
  };

  useEffect(() => {
    if (!isTeacher || !pdfDocument) return;
    emitTeacherViewport();
  }, [emitTeacherViewport, isTeacher, pdfDocument, pageWidth]);

  useEffect(() => () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  return (
    <div className={`pdf-presentation ${isTeacher ? 'is-teacher' : 'is-student'}`}>
      <div
        ref={scrollRef}
        className="pdf-presentation-scroll"
        onScroll={handleScroll}
        onContextMenu={(event) => {
          if (!isTeacher) event.preventDefault();
        }}
      >
        {loadError && <p className="pdf-viewer-error">{loadError}</p>}
        {!loadError && !pdfDocument && <p className="pdf-viewer-loading">Loading presentation...</p>}
        {pdfDocument && Array.from({ length: pdfDocument.numPages }, (_, index) => (
          <PdfPageCanvas
            key={`${material.url}-${index + 1}-${pageWidth}`}
            pdfDocument={pdfDocument}
            pageNumber={index + 1}
            width={pageWidth}
          />
        ))}
      </div>
      {!isTeacher && <div className="pdf-student-guard" aria-hidden="true" />}
    </div>
  );
};

export default PdfPresentationViewer;
