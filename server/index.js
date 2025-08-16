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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Existing drawing event
  socket.on('drawing', (data) => {
    socket.to(data.roomId).emit('drawing', data);
  });

  // New image events
  socket.on('image-added', (data) => {
    socket.to(data.roomId).emit('image-added', data);
  });

  socket.on('image-updated', (data) => {
    socket.to(data.roomId).emit('image-updated', data);
  });

  socket.on('image-deleted', (data) => {
    socket.to(data.roomId).emit('image-deleted', data);
  });

  // Existing clear event (now also clears images)
  socket.on('clear', (data) => {
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