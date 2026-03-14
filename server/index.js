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
      drawings: [],
      members: []
    };
  }
  return roomStates[roomId];
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Track which rooms this socket is in (for member cleanup on disconnect)
  const socketRooms = new Set();

  socket.on('join', (roomId) => {
    socket.join(roomId);
    socketRooms.add(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('member-join', ({ roomId, member }) => {
    const roomState = getRoomState(roomId);
    // Remove any stale entry for this member id, then add fresh
    roomState.members = roomState.members.filter(m => m.id !== member.id);
    // Attach socketId so we can clean up on disconnect
    roomState.members.push({ ...member, socketId: socket.id });
    io.to(roomId).emit('member-list', roomState.members);
    console.log(`Member ${member.name} joined room ${roomId}`);
  });

  socket.on('member-update', ({ roomId, member }) => {
    const roomState = getRoomState(roomId);
    const idx = roomState.members.findIndex(m => m.id === member.id);
    if (idx !== -1) {
      roomState.members[idx] = { ...member, socketId: socket.id };
    }
    io.to(roomId).emit('member-list', roomState.members);
  });

  // New event to send current room state to newly joined users
  socket.on('request-room-state', (roomId) => {
    const roomState = getRoomState(roomId);
    socket.emit('room-state', {
      images: roomState.images,
      drawings: roomState.drawings,
      members: roomState.members
    });
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
    // Remove this socket's member from all rooms it joined
    for (const roomId of socketRooms) {
      const roomState = roomStates[roomId];
      if (!roomState) continue;
      roomState.members = roomState.members.filter(m => m.socketId !== socket.id);
      io.to(roomId).emit('member-list', roomState.members);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});