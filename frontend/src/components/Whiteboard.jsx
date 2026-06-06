import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './Whiteboard.css';

const BOARD_BACKGROUND = '#ffffff';
const COLORS = ['#111827', '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed'];
const TOOL_LABELS = {
  pen: 'Pen',
  eraser: 'Eraser',
  line: 'Line',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  text: 'Text',
};

const Whiteboard = ({ socket, roomId, isTeacher }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const boardSizeRef = useRef({ width: 0, height: 0 });
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const activeActionRef = useRef(null);
  const lastPointRef = useRef(null);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const canUndo = historyCount > 0;
  const canRedo = redoCount > 0;

  const selectedToolLabel = useMemo(() => TOOL_LABELS[tool] || 'Tool', [tool]);

  const syncCounts = useCallback(() => {
    setHistoryCount(historyRef.current.length);
    setRedoCount(redoRef.current.length);
  }, []);

  const getContext = useCallback(() => contextRef.current, []);

  const clearCanvas = useCallback(() => {
    const context = getContext();
    const { width, height } = boardSizeRef.current;
    if (!context || !width || !height) return;

    context.save();
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, width, height);
    context.fillStyle = BOARD_BACKGROUND;
    context.fillRect(0, 0, width, height);
    context.restore();
  }, [getContext]);

  const drawAction = useCallback((action) => {
    const context = getContext();
    if (!context) return;

    context.save();
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = action.tool === 'eraser' ? BOARD_BACKGROUND : action.color;
    context.fillStyle = action.color;
    context.lineWidth = action.size;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (action.type === 'path' && action.points.length) {
      context.beginPath();
      context.moveTo(action.points[0].x, action.points[0].y);
      action.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    }

    if (action.type === 'line') {
      context.beginPath();
      context.moveTo(action.start.x, action.start.y);
      context.lineTo(action.end.x, action.end.y);
      context.stroke();
    }

    if (action.type === 'rectangle') {
      const x = Math.min(action.start.x, action.end.x);
      const y = Math.min(action.start.y, action.end.y);
      const width = Math.abs(action.end.x - action.start.x);
      const height = Math.abs(action.end.y - action.start.y);
      context.strokeRect(x, y, width, height);
    }

    if (action.type === 'ellipse') {
      const centerX = (action.start.x + action.end.x) / 2;
      const centerY = (action.start.y + action.end.y) / 2;
      const radiusX = Math.abs(action.end.x - action.start.x) / 2;
      const radiusY = Math.abs(action.end.y - action.start.y) / 2;
      context.beginPath();
      context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      context.stroke();
    }

    if (action.type === 'text') {
      context.font = `${Math.max(action.size * 4, 18)}px Inter, Segoe UI, sans-serif`;
      context.textBaseline = 'top';
      context.fillText(action.text, action.point.x, action.point.y);
    }

    context.restore();
  }, [getContext]);

  const redrawBoard = useCallback((previewAction) => {
    clearCanvas();
    historyRef.current.forEach(drawAction);
    if (previewAction) drawAction(previewAction);
  }, [clearCanvas, drawAction]);

  const broadcastHistory = useCallback(() => {
    if (socket && roomId) {
      socket.emit('sync-board', roomId, historyRef.current);
    }
  }, [roomId, socket]);

  const pushAction = useCallback((action, shouldBroadcast = true) => {
    historyRef.current = [...historyRef.current, action];
    redoRef.current = [];
    syncCounts();

    if (shouldBroadcast) {
      broadcastHistory();
    }
  }, [broadcastHistory, syncCounts]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(Math.floor(rect.width), 1);
    const height = Math.max(Math.floor(rect.height), 1);

    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;
    boardSizeRef.current = { width, height };

    redrawBoard();
  }, [redrawBoard]);

  useEffect(() => {
    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    if (canvasRef.current?.parentElement) {
      observer.observe(canvasRef.current.parentElement);
    }

    return () => observer.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleDrawAction = (drawData) => {
      const context = getContext();
      if (!context) return;

      context.save();
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = drawData.toolType === 'eraser' ? BOARD_BACKGROUND : drawData.strokeColor;
      context.lineWidth = drawData.strokeSize;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(drawData.x0, drawData.y0);
      context.lineTo(drawData.x1, drawData.y1);
      context.stroke();
      context.restore();
    };

    const handleClearBoard = () => {
      historyRef.current = [];
      redoRef.current = [];
      clearCanvas();
      syncCounts();
    };

    const handleSyncBoard = (syncedHistory = []) => {
      historyRef.current = syncedHistory;
      redoRef.current = [];
      redrawBoard();
      syncCounts();
    };

    socket.on('draw-action', handleDrawAction);
    socket.on('clear-board', handleClearBoard);
    socket.on('sync-board', handleSyncBoard);

    return () => {
      socket.off('draw-action', handleDrawAction);
      socket.off('clear-board', handleClearBoard);
      socket.off('sync-board', handleSyncBoard);
    };
  }, [clearCanvas, getContext, redrawBoard, socket, syncCounts]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const emitSegment = (from, to, activeTool, activeColor, activeSize) => {
    if (!socket || !roomId) return;

    socket.emit('draw-action', roomId, {
      x0: from.x,
      y0: from.y,
      x1: to.x,
      y1: to.y,
      strokeColor: activeTool === 'eraser' ? BOARD_BACKGROUND : activeColor,
      strokeSize: activeSize,
      toolType: activeTool,
    });
  };

  const handlePointerDown = (event) => {
    if (!isTeacher) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    const point = getPoint(event);

    if (tool === 'text') {
      const text = window.prompt('Enter text');
      if (!text?.trim()) return;

      const action = {
        type: 'text',
        tool,
        color,
        size,
        point,
        text: text.trim(),
      };
      drawAction(action);
      pushAction(action);
      return;
    }

    const action = {
      type: tool === 'pen' || tool === 'eraser' ? 'path' : tool,
      tool,
      color,
      size,
      points: [point],
      start: point,
      end: point,
    };

    activeActionRef.current = action;
    lastPointRef.current = point;
    setIsDrawing(true);
  };

  const handlePointerMove = (event) => {
    if (!isTeacher || !isDrawing || !activeActionRef.current) return;
    const point = getPoint(event);
    const action = activeActionRef.current;

    if (action.type === 'path') {
      const lastPoint = lastPointRef.current;
      action.points.push(point);
      drawAction({
        type: 'path',
        tool: action.tool,
        color: action.color,
        size: action.size,
        points: [lastPoint, point],
      });
      emitSegment(lastPoint, point, action.tool, action.color, action.size);
      lastPointRef.current = point;
      return;
    }

    action.end = point;
    redrawBoard(action);
  };

  const finishDrawing = (event) => {
    if (!isTeacher || !isDrawing || !activeActionRef.current) return;

    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const action = activeActionRef.current;
    setIsDrawing(false);
    activeActionRef.current = null;
    lastPointRef.current = null;

    const hasMeaningfulPath = action.type === 'path' && action.points.length > 1;
    const hasMeaningfulShape = action.type !== 'path'
      && Math.hypot(action.end.x - action.start.x, action.end.y - action.start.y) > 3;

    if (!hasMeaningfulPath && !hasMeaningfulShape) {
      redrawBoard();
      return;
    }

    if (action.type !== 'path') {
      redrawBoard(action);
    }

    pushAction(action);
  };

  const handleUndo = () => {
    if (!isTeacher || !historyRef.current.length) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    redoRef.current = [previous, ...redoRef.current];
    redrawBoard();
    syncCounts();
    broadcastHistory();
  };

  const handleRedo = () => {
    if (!isTeacher || !redoRef.current.length) return;
    const [next, ...remaining] = redoRef.current;
    redoRef.current = remaining;
    historyRef.current = [...historyRef.current, next];
    redrawBoard();
    syncCounts();
    broadcastHistory();
  };

  const handleClear = () => {
    if (!isTeacher) return;
    historyRef.current = [];
    redoRef.current = [];
    clearCanvas();
    syncCounts();

    if (socket && roomId) {
      socket.emit('clear-board', roomId);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const image = document.createElement('a');
    image.href = canvas.toDataURL('image/png');
    image.download = `whiteboard-${roomId || 'class'}.png`;
    image.click();
  };

  const selectTool = (nextTool) => {
    setTool(nextTool);
  };

  return (
    <section className="whiteboard-container glass-panel" aria-label="Live whiteboard">
      {isTeacher ? (
        <div className="whiteboard-toolbar" aria-label="Whiteboard tools">
          <div className="whiteboard-tool-section">
            {Object.entries(TOOL_LABELS).map(([toolKey, label]) => (
              <button
                key={toolKey}
                className={`whiteboard-tool-btn ${tool === toolKey ? 'active' : ''}`}
                onClick={() => selectTool(toolKey)}
                type="button"
                title={label}
                aria-label={label}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="whiteboard-tool-section color-section" aria-label="Colors">
            {COLORS.map((swatch) => (
              <button
                key={swatch}
                className={`color-swatch ${color === swatch ? 'active' : ''}`}
                onClick={() => {
                  setColor(swatch);
                  setTool('pen');
                }}
                style={{ '--swatch-color': swatch }}
                type="button"
                title={swatch}
                aria-label={`Use color ${swatch}`}
              />
            ))}
            <input
              className="custom-color"
              type="color"
              value={color}
              onChange={(event) => {
                setColor(event.target.value);
                setTool('pen');
              }}
              title="Custom color"
              aria-label="Custom color"
            />
          </div>

          <label className="size-control">
            <span>Size</span>
            <input
              type="range"
              min="2"
              max="28"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
              aria-label="Brush size"
            />
            <output>{size}</output>
          </label>

          <div className="whiteboard-tool-section">
            <button className="whiteboard-action-btn" onClick={handleUndo} disabled={!canUndo} type="button">
              Undo
            </button>
            <button className="whiteboard-action-btn" onClick={handleRedo} disabled={!canRedo} type="button">
              Redo
            </button>
            <button className="whiteboard-action-btn" onClick={handleDownload} type="button">
              Save
            </button>
            <button className="whiteboard-action-btn danger" onClick={handleClear} disabled={!canUndo} type="button">
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="whiteboard-viewer-badge">Student view</div>
      )}

      <div className="whiteboard-status">
        <span>{selectedToolLabel}</span>
        <span>{isTeacher ? 'Editable' : 'View only'}</span>
      </div>

      <canvas
        ref={canvasRef}
        className={`whiteboard-canvas ${isTeacher ? 'is-editable' : 'is-readonly'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
        onPointerLeave={finishDrawing}
      />
    </section>
  );
};

export default Whiteboard;
