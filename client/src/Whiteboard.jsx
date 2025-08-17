import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

// change if your server is running on other host/port
const SERVER_URL = 'http://localhost:3000';

export default function Whiteboard() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const [clientId] = useState(() => Math.random().toString(36).slice(2, 9));
  const [images, setImages] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false); // New state for cursor mode
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
      setDrawings(prev => [...prev, data]);
      drawLineFromData(data, false);
    });

    socket.on('image-added', (data) => {
      if (data.clientId === clientId) return;
      setImages(prev => [...prev, data.image]);
    });

    socket.on('image-updated', (data) => {
      if (data.clientId === clientId) return;
      setImages(prev => prev.map(img => 
        img.id === data.image.id ? data.image : img
      ));
    });

    socket.on('image-deleted', (data) => {
      if (data.clientId === clientId) return;
      setImages(prev => prev.filter(img => img.id !== data.imageId));
    });

    socket.on('clear', () => {
      clearCanvasLocal();
      setImages([]);
      setDrawings([]);
    });

    // New event for initial image sync
    socket.on('room-state', (data) => {
      setImages(data.images || []);
      setDrawings(data.drawings || []);
    });

    // Request current room state when joining
    socket.emit('request-room-state', roomId);

    return () => {
      socket.disconnect();
    };
  }, [clientId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Add paste event listener
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
            // Auto-switch to select mode after pasting an image
            setIsSelectMode(true);
          }
        }
      }
    };
    
    window.addEventListener('paste', handlePaste);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  // Redraw everything whenever images or drawings change
  useEffect(() => {
    redrawCanvas();
  }, [images, drawings]);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight || 600;
    redrawCanvas();
  }

  function redrawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Clear the entire canvas first
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw all drawings first (so they appear behind images)
    drawings.forEach(drawingData => {
      drawLineFromData(drawingData, false);
    });
    
    // Then redraw all images on top
    images.forEach(imageData => {
      drawImage(imageData);
    });
  }

  function drawImage(imageData) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, imageData.x, imageData.y, imageData.width, imageData.height);
      
      // Draw selection border if selected
      if (selectedImage && selectedImage.id === imageData.id) {
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(imageData.x, imageData.y, imageData.width, imageData.height);
        
        // Draw resize handles (larger for easier interaction)
        const handleSize = 12;
        ctx.fillStyle = '#007bff';
        ctx.setLineDash([]);
        // Corner handles
        ctx.fillRect(imageData.x - handleSize/2, imageData.y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(imageData.x + imageData.width - handleSize/2, imageData.y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(imageData.x - handleSize/2, imageData.y + imageData.height - handleSize/2, handleSize, handleSize);
        ctx.fillRect(imageData.x + imageData.width - handleSize/2, imageData.y + imageData.height - handleSize/2, handleSize, handleSize);
        
        // Edge handles for easier resizing
        ctx.fillRect(imageData.x + imageData.width/2 - handleSize/2, imageData.y - handleSize/2, handleSize, handleSize); // top
        ctx.fillRect(imageData.x + imageData.width/2 - handleSize/2, imageData.y + imageData.height - handleSize/2, handleSize, handleSize); // bottom
        ctx.fillRect(imageData.x - handleSize/2, imageData.y + imageData.height/2 - handleSize/2, handleSize, handleSize); // left
        ctx.fillRect(imageData.x + imageData.width - handleSize/2, imageData.y + imageData.height/2 - handleSize/2, handleSize, handleSize); // right
      }
    };
    img.src = imageData.src;
  }

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate size to fit within canvas while maintaining aspect ratio
        const canvas = canvasRef.current;
        const maxWidth = canvas.width * 0.5;
        const maxHeight = canvas.height * 0.5;
        
        let { width, height } = img;
        const aspectRatio = width / height;
        
        if (width > maxWidth) {
          width = maxWidth;
          height = width / aspectRatio;
        }
        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }
        
        const imageData = {
          id: Math.random().toString(36).slice(2, 12),
          src: e.target.result,
          x: 50,
          y: 50,
          width: Math.round(width),
          height: Math.round(height)
        };
        
        setImages(prev => [...prev, imageData]);
        
        // Emit image-added event with proper structure
        socketRef.current.emit('image-added', {
          roomId,
          clientId,
          image: imageData
        });
        
        // Auto-select the newly added image
        setSelectedImage(imageData);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function getMousePos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    };
  }

  function getImageAtPos(pos) {
    // Check from top to bottom (reverse order since last drawn is on top)
    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i];
      if (pos.x >= img.x && pos.x <= img.x + img.width &&
          pos.y >= img.y && pos.y <= img.y + img.height) {
        return img;
      }
    }
    return null;
  }

  function getResizeHandle(pos, imageData) {
    const handleSize = 12;
    const handles = [
      { name: 'nw', x: imageData.x - handleSize/2, y: imageData.y - handleSize/2 },
      { name: 'ne', x: imageData.x + imageData.width - handleSize/2, y: imageData.y - handleSize/2 },
      { name: 'sw', x: imageData.x - handleSize/2, y: imageData.y + imageData.height - handleSize/2 },
      { name: 'se', x: imageData.x + imageData.width - handleSize/2, y: imageData.y + imageData.height - handleSize/2 },
      { name: 'n', x: imageData.x + imageData.width/2 - handleSize/2, y: imageData.y - handleSize/2 },
      { name: 's', x: imageData.x + imageData.width/2 - handleSize/2, y: imageData.y + imageData.height - handleSize/2 },
      { name: 'w', x: imageData.x - handleSize/2, y: imageData.y + imageData.height/2 - handleSize/2 },
      { name: 'e', x: imageData.x + imageData.width - handleSize/2, y: imageData.y + imageData.height/2 - handleSize/2 }
    ];
    
    for (let handle of handles) {
      if (pos.x >= handle.x && pos.x <= handle.x + handleSize &&
          pos.y >= handle.y && pos.y <= handle.y + handleSize) {
        return handle.name;
      }
    }
    return null;
  }

  function startDrawing(e) {
    const pos = getMousePos(e);
    const clickedImage = getImageAtPos(pos);
    
    if (clickedImage) {
      setSelectedImage(clickedImage);
      
      // Check if clicking on resize handle
      const handle = getResizeHandle(pos, clickedImage);
      if (handle) {
        setResizing(handle);
        setIsDraggingImage(false);
        return;
      }
      
      // Start dragging image
      setIsDraggingImage(true);
      setDragOffset({
        x: pos.x - clickedImage.x,
        y: pos.y - clickedImage.y
      });
      return;
    }
    
    // If in select mode and clicked on empty space, deselect image
    if (isSelectMode) {
      setSelectedImage(null);
      setIsDraggingImage(false);
      return;
    }
    
    // Deselect image and start drawing (only in draw mode)
    setSelectedImage(null);
    setIsDraggingImage(false);
    drawingRef.current = true;
    lastPosRef.current = pos;
  }

  function stopDrawing() {
    drawingRef.current = false;
    setResizing(false);
    setIsDraggingImage(false);
  }

  function handleMouseMove(e) {
    const pos = getMousePos(e);
    
    if (resizing && selectedImage) {
      // Handle resizing
      const newImage = { ...selectedImage };
      const startX = selectedImage.x;
      const startY = selectedImage.y;
      const startWidth = selectedImage.width;
      const startHeight = selectedImage.height;
      
      switch (resizing) {
        case 'se':
          newImage.width = Math.max(20, pos.x - startX);
          newImage.height = Math.max(20, pos.y - startY);
          break;
        case 'sw':
          newImage.x = Math.min(pos.x, startX + startWidth - 20);
          newImage.width = Math.max(20, startX + startWidth - pos.x);
          newImage.height = Math.max(20, pos.y - startY);
          break;
        case 'ne':
          newImage.width = Math.max(20, pos.x - startX);
          newImage.y = Math.min(pos.y, startY + startHeight - 20);
          newImage.height = Math.max(20, startY + startHeight - pos.y);
          break;
        case 'nw':
          newImage.x = Math.min(pos.x, startX + startWidth - 20);
          newImage.y = Math.min(pos.y, startY + startHeight - 20);
          newImage.width = Math.max(20, startX + startWidth - pos.x);
          newImage.height = Math.max(20, startY + startHeight - pos.y);
          break;
        case 'n':
          newImage.y = Math.min(pos.y, startY + startHeight - 20);
          newImage.height = Math.max(20, startY + startHeight - pos.y);
          break;
        case 's':
          newImage.height = Math.max(20, pos.y - startY);
          break;
        case 'w':
          newImage.x = Math.min(pos.x, startX + startWidth - 20);
          newImage.width = Math.max(20, startX + startWidth - pos.x);
          break;
        case 'e':
          newImage.width = Math.max(20, pos.x - startX);
          break;
      }
      
      setImages(prev => prev.map(img => 
        img.id === selectedImage.id ? newImage : img
      ));
      setSelectedImage(newImage);
      
      socketRef.current.emit('image-updated', {
        roomId,
        clientId,
        image: newImage
      });
      return;
    }
    
    if (isDraggingImage && selectedImage) {
      // Handle dragging image
      const newImage = {
        ...selectedImage,
        x: pos.x - dragOffset.x,
        y: pos.y - dragOffset.y
      };
      
      setImages(prev => prev.map(img => 
        img.id === selectedImage.id ? newImage : img
      ));
      setSelectedImage(newImage);
      
      socketRef.current.emit('image-updated', {
        roomId,
        clientId,
        image: newImage
      });
      return;
    }
    
    if (!drawingRef.current || isSelectMode) return;
    
    // Original drawing logic - only when not in select mode and not interacting with images
    const line = { from: lastPosRef.current, to: pos };
    const payload = {
      roomId,
      clientId,
      line,
      color,
      width
    };
    
    // Store the drawing data
    setDrawings(prev => [...prev, payload]);
    
    drawLineFromData(payload, true);
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
    setImages([]);
    setDrawings([]);
    setSelectedImage(null);
    socketRef.current.emit('clear', { roomId, clientId });
  }

  function handleFileUpload() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
      // Auto-switch to select mode after uploading an image
      setIsSelectMode(true);
    }
  }

  function deleteSelectedImage() {
    if (selectedImage) {
      setImages(prev => prev.filter(img => img.id !== selectedImage.id));
      socketRef.current.emit('image-deleted', {
        roomId,
        clientId,
        imageId: selectedImage.id
      });
      setSelectedImage(null);
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedImage) {
          e.preventDefault();
          deleteSelectedImage();
        }
      }
      // Toggle between draw and select modes with 'S' key
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsSelectMode(prev => !prev);
        setSelectedImage(null); // Deselect when switching modes
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

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

  // Get cursor style based on current mode
  function getCursorStyle() {
    if (isSelectMode) return 'default';
    return 'crosshair';
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
        <button 
          onClick={() => setIsSelectMode(!isSelectMode)}
          style={{
            backgroundColor: isSelectMode ? '#28a745' : '#6c757d',
            color: 'white'
          }}
          title="Toggle between draw and select mode (Press 'S')"
        >
          {isSelectMode ? '👆 Selecting Mode' : '✏️ Drawing Mode'}
        </button>
        <button onClick={handleClear}>Clear</button>
        <button onClick={handleFileUpload}>Upload Image</button>
        {selectedImage && (
          <button onClick={deleteSelectedImage} style={{backgroundColor: '#dc3545', color: 'white'}}>
            Delete Image
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
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
          style={{ cursor: getCursorStyle() }}
        />
      </div>
      
      <div className="instructions">
        <p><strong>Controls:</strong></p>
        <ul>
          <li><strong>Toggle Mode:</strong> Click "Draw/Select" button or press 'S'</li>
          <li><strong>Drawing Mode:</strong> ✏️ Draw lines on canvas</li>
          <li><strong>Selecting Mode:</strong> 👆 Click to select/move images</li>
        </ul>
        <p><strong>Image Controls:</strong></p>
        <ul>
          <li>Upload images using the "Upload Image" button</li>
          <li>Paste images directly with Ctrl+V (Cmd+V on Mac)</li>
          <li>Click images to select them (blue border appears)</li>
          <li>Drag anywhere inside selected image to move it</li>
          <li>Drag blue handles to resize (corners + edges)</li>
          <li>Press Delete/Backspace to remove selected image</li>
        </ul>
      </div>
    </div>
  );
}