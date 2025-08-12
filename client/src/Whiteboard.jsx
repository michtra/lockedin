import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

// change if your server is running on other host/port
const SERVER_URL = 'http://localhost:3000';

export default function Whiteboard() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const [clientId] = useState(() => Math.random().toString(36).slice(2, 9));
  const roomId = 'global';

  useEffect(() => {
    socketRef.current = io(SERVER_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('connected to server', socket.id);
      socket.emit('join', roomId);
    });

    socket.on('drawing', (data) => {
      // ignore our own emits if they somehow loop back
      if (data.clientId === clientId) return;
      drawLineFromData(data, false);
    });

    socket.on('clear', () => {
      clearCanvasLocal();
    });

    return () => {
      socket.disconnect();
    };
  }, [clientId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight || 600;
    // optional: redraw background or saved strokes (not implemented)
  }

  function getMousePos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    };
  }

  function startDrawing(e) {
    drawingRef.current = true;
    const pos = getMousePos(e);
    lastPosRef.current = pos;
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function handleMouseMove(e) {
    if (!drawingRef.current) return;
    const pos = getMousePos(e);
    const line = { from: lastPosRef.current, to: pos };
    const payload = {
      roomId,
      clientId,
      line,
      color,
      width
    };
    drawLineFromData(payload, true);
    // throttle/batch if needed (for now send every move)
    socketRef.current.emit('drawing', payload);
    lastPosRef.current = pos;
  }

  function drawLineFromData(data, isLocal) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = data.color || '#000';
    ctx.lineWidth = data.width || 2;

    const { from, to } = data.line;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.closePath();
  }

  function clearCanvasLocal() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function handleClear() {
    clearCanvasLocal();
    socketRef.current.emit('clear', { roomId, clientId });
  }

  // touch events support
  function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const fake = { clientX: touch.clientX, clientY: touch.clientY };
    startDrawing(fake);
  }

  function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const fake = { clientX: touch.clientX, clientY: touch.clientY };
    handleMouseMove(fake);
  }

  return (
    <div className="whiteboard-container">
      <div className="controls">
        <label>
          Color:
          <input value={color} onChange={(e) => setColor(e.target.value)} type="color" />
        </label>
        <label>
          Width:
          <input
            type="range"
            min="1"
            max="20"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
        <button onClick={handleClear}>Clear</button>
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          onTouchMove={handleTouchMove}
        />
      </div>
    </div>
  );
}
