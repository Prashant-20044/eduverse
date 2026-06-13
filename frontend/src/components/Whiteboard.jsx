import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import rough from 'roughjs';
import {
  Pencil,
  Eraser,
  Minus,
  Square,
  Circle,
  Type,
  Undo2,
  Redo2,
  Download,
  Camera,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Sparkles,
  MousePointerClick
} from 'lucide-react';
import './Whiteboard.css';

const BOARD_BACKGROUND = '#ffffff';
const INITIAL_BOARD_HEIGHT = 1600;
const BOARD_HEIGHT_STEP = 800;
const COLORS = [
  '#1e293b', // Slate
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#ea580c', // Orange
  '#7c3aed', // Purple
  '#0891b2', // Cyan
];
const TOOL_LABELS = {
  pen: 'Pen',
  eraser: 'Eraser',
  line: 'Line',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  text: 'Text',
};

const Whiteboard = ({ socket, roomId, isTeacher, onSnapshotSaved }) => {
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const contextRef = useRef(null);
  const boardSizeRef = useRef({ width: 0, height: 0 });
  const boardHeightRef = useRef(INITIAL_BOARD_HEIGHT);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const activeActionRef = useRef(null);
  const lastPointRef = useRef(null);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#1e293b');
  const [size, setSize] = useState(4);
  const [fillStyle, setFillStyle] = useState('none'); // 'none' | 'hachure' | 'solid'
  const [strokeStyle, setStrokeStyle] = useState('solid'); // 'solid' | 'dashed'
  const [isDrawing, setIsDrawing] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [hoverDrawMode, setHoverDrawMode] = useState(false);
  const [boardHeight, setBoardHeight] = useState(INITIAL_BOARD_HEIGHT);
  const [saveStatus, setSaveStatus] = useState('');
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  // Tracks the last seen pointer device type for the status indicator
  const [activePointerType, setActivePointerType] = useState(null);
  // Tracks whether the pointer is physically pressed (for non-hover mode)
  const isPointerDownRef = useRef(false);
  // Tracks whether hover-draw is currently active (pointer inside canvas)
  const hoverDrawActiveRef = useRef(false);
  // Tracks whether a pen/touch pressure-stroke is in progress
  const pressureDrawingRef = useRef(false);

  const canUndo = historyCount > 0;
  const canRedo = redoCount > 0;

  const selectedToolLabel = useMemo(() => TOOL_LABELS[tool] || 'Tool', [tool]);

  useEffect(() => {
    boardHeightRef.current = boardHeight;
  }, [boardHeight]);

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
    const canvas = canvasRef.current;
    if (!context || !canvas) return;

    if (action.tool === 'eraser') {
      context.save();
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = BOARD_BACKGROUND;
      context.lineWidth = action.size * 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      if (action.type === 'path' && action.points.length) {
        context.beginPath();
        context.moveTo(action.points[0].x, action.points[0].y);
        action.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.stroke();
      }
      context.restore();
      return;
    }

    if (action.type === 'text') {
      context.save();
      context.fillStyle = action.color;
      context.font = `bold ${Math.max(action.size * 4, 18)}px "Comic Sans MS", "Architects Daughter", cursive, sans-serif`;
      context.textBaseline = 'top';
      context.fillText(action.text, action.point.x, action.point.y);
      context.restore();
      return;
    }

    const rc = rough.canvas(canvas);
    const options = {
      stroke: action.color,
      strokeWidth: action.size,
      roughness: action.type === 'path' ? 0.75 : 1.4,
      bowing: 1.5,
    };

    if (action.strokeStyle === 'dashed') {
      options.strokeLineDash = [8, 8];
    }

    if (action.fillStyle && action.fillStyle !== 'none') {
      options.fill = action.color;
      options.fillStyle = action.fillStyle;
      options.fillWeight = Math.max(action.size / 2, 1.5);
    }

    if (action.type === 'path' && action.points.length) {
      const pts = action.points.map(p => [p.x, p.y]);
      rc.linearPath(pts, options);
    }

    if (action.type === 'line') {
      rc.line(action.start.x, action.start.y, action.end.x, action.end.y, options);
    }

    if (action.type === 'rectangle') {
      const x = Math.min(action.start.x, action.end.x);
      const y = Math.min(action.start.y, action.end.y);
      const w = Math.abs(action.end.x - action.start.x);
      const h = Math.abs(action.end.y - action.start.y);
      rc.rectangle(x, y, w, h, options);
    }

    if (action.type === 'ellipse') {
      const centerX = (action.start.x + action.end.x) / 2;
      const centerY = (action.start.y + action.end.y) / 2;
      const diameterX = Math.abs(action.end.x - action.start.x);
      const diameterY = Math.abs(action.end.y - action.start.y);
      rc.ellipse(centerX, centerY, diameterX, diameterY, options);
    }
  }, [getContext]);

  const redrawBoard = useCallback((previewAction) => {
    clearCanvas();
    historyRef.current.forEach(drawAction);
    if (previewAction) drawAction(previewAction);
  }, [clearCanvas, drawAction]);

  const broadcastHistory = useCallback(() => {
    if (socket && roomId) {
      socket.emit('sync-board', roomId, {
        history: historyRef.current,
        boardHeight: boardHeightRef.current,
      });
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

    const handleSyncBoard = (payload = []) => {
      const nextHistory = Array.isArray(payload) ? payload : payload.history || [];
      const nextBoardHeight = Array.isArray(payload) ? boardHeightRef.current : payload.boardHeight;

      historyRef.current = nextHistory;
      redoRef.current = [];

      if (nextBoardHeight && nextBoardHeight !== boardHeightRef.current) {
        boardHeightRef.current = nextBoardHeight;
        setBoardHeight(nextBoardHeight);
      } else {
        redrawBoard();
      }

      syncCounts();
    };

    socket.on('draw-action', handleDrawAction);
    socket.on('clear-board', handleClearBoard);
    socket.on('sync-board', handleSyncBoard);

    if (roomId) {
      socket.emit('request-board-sync', roomId);
    }

    return () => {
      socket.off('draw-action', handleDrawAction);
      socket.off('clear-board', handleClearBoard);
      socket.off('sync-board', handleSyncBoard);
    };
  }, [clearCanvas, getContext, redrawBoard, socket, syncCounts]);

  useEffect(() => {
    resizeCanvas();
  }, [boardHeight, resizeCanvas]);

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

  // Starts a new drawing action at the given point
  const startAction = useCallback((point) => {
    const action = {
      type: tool === 'pen' || tool === 'eraser' ? 'path' : tool,
      tool,
      color,
      size,
      points: [point],
      start: point,
      end: point,
      fillStyle,
      strokeStyle,
    };
    activeActionRef.current = action;
    lastPointRef.current = point;
    setIsDrawing(true);
  }, [color, size, tool, fillStyle, strokeStyle]);

  const handlePointerDown = (event) => {
    if (!isTeacher) return;
    isPointerDownRef.current = true;
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

    // In hover-draw mode for path tools, drawing is already active — no need to start again
    if (hoverDrawMode && hoverDrawActiveRef.current && (tool === 'pen' || tool === 'eraser')) return;

    startAction(point);
  };

  const handlePointerMove = (event) => {
    if (!isTeacher) return;

    // Track what kind of device is being used so we can show it in the status bar
    setActivePointerType(event.pointerType);

    const point = getPoint(event);
    const isPenOrTouch = event.pointerType === 'pen' || event.pointerType === 'touch';
    const hasPressure = event.pressure > 0;

    // ── PRESSURE-BASED DRAWING (stylus / writing pad / finger touch) ────────────
    // For pen and touch input we rely on pressure instead of click events.
    // pressure > 0  → pen/finger is touching the surface → draw
    // pressure === 0 → pen/finger is lifted              → commit stroke
    if (isPenOrTouch && (tool === 'pen' || tool === 'eraser')) {
      if (hasPressure) {
        if (!pressureDrawingRef.current) {
          // Pen just touched down — start a new stroke
          pressureDrawingRef.current = true;
          startAction(point);
          return;
        }
        // Pen is still pressed — continue the stroke
        const action = activeActionRef.current;
        if (action && action.type === 'path') {
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
        }
        return;
      }

      // pressure === 0: pen lifted — commit the current stroke
      if (pressureDrawingRef.current) {
        pressureDrawingRef.current = false;
        if (!isDrawing || !activeActionRef.current) return;
        const action = activeActionRef.current;
        setIsDrawing(false);
        activeActionRef.current = null;
        lastPointRef.current = null;
        if (action.type === 'path' && action.points.length > 1) {
          pushAction(action);
        } else {
          redrawBoard();
        }
      }
      return;
    }

    // ── MOUSE HOVER-DRAW MODE ────────────────────────────────────────────────────
    if (hoverDrawMode && (tool === 'pen' || tool === 'eraser')) {
      if (!isDrawing) {
        hoverDrawActiveRef.current = true;
        startAction(point);
        return;
      }
      const action = activeActionRef.current;
      if (action && action.type === 'path') {
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
      }
      return;
    }

    // ── NORMAL CLICK-DRAG DRAWING ────────────────────────────────────────────────
    if (!isDrawing || !activeActionRef.current) return;
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
    isPointerDownRef.current = false;
    // Also reset pressure-drawing if pen leaves canvas entirely
    if (pressureDrawingRef.current) {
      pressureDrawingRef.current = false;
    }

    // In hover-draw mode for path tools, only commit when pointer LEAVES the canvas
    // (handled by pointerleave). For other tools, finish normally.
    if (hoverDrawMode && activeActionRef.current?.type === 'path' && event?.type !== 'pointerleave' && event?.type !== 'pointercancel') {
      return;
    }

    if (!isTeacher || !isDrawing || !activeActionRef.current) return;

    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    hoverDrawActiveRef.current = false;
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

  // When pointer re-enters canvas in hover-draw mode, resume drawing
  const handlePointerEnter = (event) => {
    if (!isTeacher || !hoverDrawMode || !(tool === 'pen' || tool === 'eraser')) return;
    if (isDrawing) return; // already drawing
    hoverDrawActiveRef.current = true;
    const point = getPoint(event);
    startAction(point);
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

  const handleSaveSnapshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !isTeacher || isSavingSnapshot) return;

    setIsSavingSnapshot(true);
    setSaveStatus('');

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `whiteboard-${roomId || 'class'}-${timestamp}.png`;
      const res = await axios.post(`/api/upload/whiteboard/${roomId}`, {
        imageData: canvas.toDataURL('image/png'),
        filename,
      });

      if (res.data.success) {
        setSaveStatus('Saved for students');
        onSnapshotSaved?.(res.data.material);
        socket?.emit('whiteboard-snapshot-saved', roomId, res.data.material);
      }
    } catch (err) {
      setSaveStatus(err.response?.data?.message || 'Save failed');
    } finally {
      setIsSavingSnapshot(false);
      window.setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const scrollBoard = (position) => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    scrollElement.scrollTo({
      top: position === 'top' ? 0 : scrollElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  const handleAddSpace = () => {
    if (!isTeacher) return;

    const nextHeight = boardHeightRef.current + BOARD_HEIGHT_STEP;
    boardHeightRef.current = nextHeight;
    setBoardHeight(nextHeight);

    if (socket && roomId) {
      socket.emit('sync-board', roomId, {
        history: historyRef.current,
        boardHeight: nextHeight,
      });
    }

    window.setTimeout(() => scrollBoard('bottom'), 80);
  };

  const selectTool = (nextTool) => {
    setTool(nextTool);
    // Hover-draw only makes sense for path tools; auto-disable for shapes/text
    if (nextTool !== 'pen' && nextTool !== 'eraser') {
      setHoverDrawMode(false);
    }
  };

  const toggleHoverDraw = () => {
    setHoverDrawMode((prev) => !prev);
    // When activating, switch to pen if a non-path tool is selected
    if (!hoverDrawMode && tool !== 'pen' && tool !== 'eraser') {
      setTool('pen');
    }
  };

  const getToolIcon = (toolKey) => {
    switch (toolKey) {
      case 'pen': return <Pencil size={18} />;
      case 'eraser': return <Eraser size={18} />;
      case 'line': return <Minus size={18} style={{ transform: 'rotate(-45deg)' }} />;
      case 'rectangle': return <Square size={18} />;
      case 'ellipse': return <Circle size={18} />;
      case 'text': return <Type size={18} />;
      default: return null;
    }
  };

  return (
    <section className="whiteboard-container" aria-label="Live whiteboard">
      {isTeacher ? (
        <>
          {/* Central Top Floating Toolbar */}
          <div className="wb-floating-toolbar" aria-label="Whiteboard tools">
            {Object.keys(TOOL_LABELS).map((toolKey) => (
              <button
                key={toolKey}
                className={`wb-tool-btn ${tool === toolKey ? 'active' : ''}`}
                onClick={() => selectTool(toolKey)}
                type="button"
                title={TOOL_LABELS[toolKey]}
              >
                {getToolIcon(toolKey)}
              </button>
            ))}
            
            <div className="wb-separator" />

            <button
              className={`wb-tool-btn hover-draw-btn ${hoverDrawMode ? 'active' : ''}`}
              onClick={toggleHoverDraw}
              type="button"
              title="Mouse Hover Draw Mode (Draw without clicking)"
            >
              <MousePointerClick size={18} />
            </button>
          </div>

          {/* Left Properties Panel */}
          <div className="wb-properties-panel">
            <div className="wb-panel-title">Stroke Color</div>
            <div className="wb-color-grid">
              {COLORS.map((swatch) => (
                <button
                  key={swatch}
                  className={`wb-color-swatch ${color === swatch ? 'active' : ''}`}
                  onClick={() => {
                    setColor(swatch);
                    if (tool === 'eraser') setTool('pen');
                  }}
                  style={{ backgroundColor: swatch }}
                  type="button"
                  title={swatch}
                />
              ))}
              <div className="wb-custom-color-wrapper">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    if (tool === 'eraser') setTool('pen');
                  }}
                  className="wb-custom-color-input"
                  title="Custom Color"
                />
                <Sparkles size={14} className="wb-custom-color-icon" />
              </div>
            </div>

            {tool !== 'eraser' && tool !== 'text' && (
              <>
                <div className="wb-separator-h" />
                <div className="wb-panel-title">Fill Style</div>
                <div className="wb-option-group">
                  <button
                    className={`wb-option-btn ${fillStyle === 'none' ? 'active' : ''}`}
                    onClick={() => setFillStyle('none')}
                    type="button"
                  >
                    Transparent
                  </button>
                  <button
                    className={`wb-option-btn ${fillStyle === 'hachure' ? 'active' : ''}`}
                    onClick={() => setFillStyle('hachure')}
                    type="button"
                  >
                    Hachure
                  </button>
                  <button
                    className={`wb-option-btn ${fillStyle === 'solid' ? 'active' : ''}`}
                    onClick={() => setFillStyle('solid')}
                    type="button"
                  >
                    Solid
                  </button>
                </div>

                <div className="wb-separator-h" />
                <div className="wb-panel-title">Stroke Style</div>
                <div className="wb-option-group">
                  <button
                    className={`wb-option-btn ${strokeStyle === 'solid' ? 'active' : ''}`}
                    onClick={() => setStrokeStyle('solid')}
                    type="button"
                  >
                    Solid
                  </button>
                  <button
                    className={`wb-option-btn ${strokeStyle === 'dashed' ? 'active' : ''}`}
                    onClick={() => setStrokeStyle('dashed')}
                    type="button"
                  >
                    Dashed
                  </button>
                </div>
              </>
            )}

            <div className="wb-separator-h" />
            <div className="wb-panel-title">Stroke Width ({size}px)</div>
            <div className="wb-size-slider-container">
              <input
                type="range"
                min="2"
                max="20"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="wb-slider"
              />
            </div>
          </div>

          {/* Bottom Left Undo/Redo/Clear Panel */}
          <div className="wb-actions-panel bottom-left">
            <button
              className="wb-action-btn"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo"
              type="button"
            >
              <Undo2 size={16} />
            </button>
            <button
              className="wb-action-btn"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo"
              type="button"
            >
              <Redo2 size={16} />
            </button>
            <button
              className="wb-action-btn danger"
              onClick={handleClear}
              disabled={!canUndo}
              title="Clear Canvas"
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Bottom Right Canvas Controls Panel */}
          <div className="wb-actions-panel bottom-right">
            <button
              className="wb-action-btn text-btn"
              onClick={() => scrollBoard('top')}
              type="button"
            >
              <ArrowUp size={14} /> Top
            </button>
            <button
              className="wb-action-btn text-btn"
              onClick={() => scrollBoard('bottom')}
              type="button"
            >
              <ArrowDown size={14} /> Bottom
            </button>
            <button
              className="wb-action-btn text-btn"
              onClick={handleAddSpace}
              type="button"
            >
              <Plus size={14} /> Add Space
            </button>
            <div className="wb-vertical-separator" />
            <button
              className="wb-action-btn text-btn"
              onClick={handleSaveSnapshot}
              disabled={isSavingSnapshot}
              type="button"
            >
              <Camera size={14} /> {isSavingSnapshot ? 'Saving...' : 'Save Snap'}
            </button>
            <button
              className="wb-action-btn text-btn"
              onClick={handleDownload}
              type="button"
            >
              <Download size={14} /> Export
            </button>
          </div>
        </>
      ) : (
        <div className="wb-viewer-badge">Student View Mode</div>
      )}

      {/* Floating Status Indicator */}
      <div className="wb-floating-status">
        <span className="wb-status-tool">{selectedToolLabel}</span>
        {saveStatus && <span className="wb-status-msg">{saveStatus}</span>}
        {activePointerType && (
          <span className={`wb-pointer-badge ${activePointerType}`}>
            {activePointerType === 'pen' && '✏️ Stylus'}
            {activePointerType === 'touch' && '👆 Touch'}
            {activePointerType === 'mouse' && '🖱️ Mouse'}
          </span>
        )}
        <span className="wb-status-role">{isTeacher ? 'Teacher (Editable)' : 'Student (View Only)'}</span>
      </div>

      <div className="whiteboard-scroll-area" ref={scrollRef}>
        <canvas
          ref={canvasRef}
          className={`whiteboard-canvas ${isTeacher ? 'is-editable' : 'is-readonly'} ${hoverDrawMode ? 'hover-draw-active' : ''}`}
          style={{ height: `${boardHeight}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          onPointerLeave={finishDrawing}
          onPointerEnter={handlePointerEnter}
        />
      </div>
    </section>
  );
};

export default Whiteboard;
