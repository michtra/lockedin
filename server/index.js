const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Adjust this to match your React app's URL
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Store room states in memory (in production, you'd want to use Redis or a database)
const roomStates = {};

function getRoomState(roomId) {
  if (!roomStates[roomId]) {
    roomStates[roomId] = {
      images: [],
      drawings: []
    };
  }
  return roomStates[roomId];
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // New event to send current room state to newly joined users
  socket.on('request-room-state', (roomId) => {
    const roomState = getRoomState(roomId);
    socket.emit('room-state', roomState);
    console.log(`Sent room state to ${socket.id} for room ${roomId}`);
  });

  // Existing drawing event
  socket.on('drawing', (data) => {
    // Store the drawing in room state
    const roomState = getRoomState(data.roomId);
    roomState.drawings.push(data);
    
    socket.to(data.roomId).emit('drawing', data);
  });

  // Enhanced image events with room state management
  socket.on('image-added', (data) => {
    // Store the image in room state
    const roomState = getRoomState(data.roomId);
    roomState.images.push(data.image);
    
    socket.to(data.roomId).emit('image-added', data);
    console.log(`Image added to room ${data.roomId} by ${data.clientId}`);
  });

  socket.on('image-updated', (data) => {
    // Update the image in room state
    const roomState = getRoomState(data.roomId);
    const imageIndex = roomState.images.findIndex(img => img.id === data.image.id);
    if (imageIndex !== -1) {
      roomState.images[imageIndex] = data.image;
    }
    
    socket.to(data.roomId).emit('image-updated', data);
  });

  socket.on('image-deleted', (data) => {
    // Remove the image from room state
    const roomState = getRoomState(data.roomId);
    roomState.images = roomState.images.filter(img => img.id !== data.imageId);
    
    socket.to(data.roomId).emit('image-deleted', data);
  });

  // Enhanced clear event (now also clears room state)
  socket.on('clear', (data) => {
    // Clear room state
    const roomState = getRoomState(data.roomId);
    roomState.images = [];
    roomState.drawings = [];
    
    socket.to(data.roomId).emit('clear', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});