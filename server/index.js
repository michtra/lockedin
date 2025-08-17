// server/index.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Store timer state for each room
const roomTimers = new Map();

function getDefaultTimerState() {
  return {
    timeLeft: 25 * 60, // 25 minutes in seconds
    isRunning: false,
    isBreak: false,
    sessions: 0,
    focusMinutes: 25,
    breakMinutes: 5,
    startTime: null,
    intervalId: null
  };
}

function getOrCreateTimerState(roomId) {
  if (!roomTimers.has(roomId)) {
    roomTimers.set(roomId, getDefaultTimerState());
  }
  return roomTimers.get(roomId);
}

function broadcastTimerState(roomId) {
  const timerState = getOrCreateTimerState(roomId);
  io.to(roomId).emit('timer_state', {
    timeLeft: timerState.timeLeft,
    isRunning: timerState.isRunning,
    isBreak: timerState.isBreak,
    sessions: timerState.sessions,
    focusMinutes: timerState.focusMinutes,
    breakMinutes: timerState.breakMinutes
  });
}

function startTimer(roomId) {
  const timerState = getOrCreateTimerState(roomId);
  
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
  }
  
  timerState.isRunning = true;
  timerState.startTime = Date.now();
  
  timerState.intervalId = setInterval(() => {
    timerState.timeLeft--;
    
    if (timerState.timeLeft <= 0) {
      // Timer finished
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
      timerState.isRunning = false;
      
      // Notify all clients that timer finished (for sound notification)
      const completedSession = timerState.isBreak ? 'break' : 'focus'
      let nextSession
      
      if (timerState.isBreak) {
        // Break finished, start focus session
        timerState.isBreak = false;
        timerState.timeLeft = timerState.focusMinutes * 60;
        nextSession = 'focus'
      } else {
        // Focus session finished, start break
        timerState.isBreak = true;
        timerState.sessions++;
        timerState.timeLeft = timerState.breakMinutes * 60;
        nextSession = 'break'
      }
      
      io.to(roomId).emit('timer_finished', {
        sessionType: completedSession,
        nextSessionType: nextSession
      });
      
      console.log(`Timer session completed in room ${roomId}. New state: ${timerState.isBreak ? 'Break' : 'Focus'}, Sessions: ${timerState.sessions}`);
    }
    
    // Broadcast updated state every second
    broadcastTimerState(roomId);
  }, 1000);
}

function pauseTimer(roomId) {
  const timerState = getOrCreateTimerState(roomId);
  
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  
  timerState.isRunning = false;
  broadcastTimerState(roomId);
}

function resetTimer(roomId) {
  const timerState = getOrCreateTimerState(roomId);
  
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  
  timerState.isRunning = false;
  timerState.isBreak = false;
  timerState.timeLeft = timerState.focusMinutes * 60;
  timerState.sessions = 0;
  timerState.startTime = null;
  
  broadcastTimerState(roomId);
}

function skipTimer(roomId) {
  const timerState = getOrCreateTimerState(roomId);
  
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  
  timerState.isRunning = false;
  
  if (timerState.isBreak) {
    // Skip break, go to focus
    timerState.isBreak = false;
    timerState.timeLeft = timerState.focusMinutes * 60;
  } else {
    // Skip focus, go to break
    timerState.isBreak = true;
    timerState.sessions++;
    timerState.timeLeft = timerState.breakMinutes * 60;
  }
  
  broadcastTimerState(roomId);
}

// Serve client build (optional if you later build client into dist)
app.use(express.static(path.join(__dirname, '..', 'client')));

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // user joins room (optional: default room)
  socket.on('join', (roomId = 'global') => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`${socket.id} joined ${roomId}`);
  });

  // WHITEBOARD EVENTS
  // receive a drawing event and broadcast to other clients in same room
  socket.on('drawing', (data) => {
    // data should include: { roomId, line, color, width, clientId(optional) }
    const roomId = data.roomId || socket.roomId || 'global';
    socket.to(roomId).emit('drawing', data);
  });

  // clear board event
  socket.on('clear', (data) => {
    const roomId = data.roomId || socket.roomId || 'global';
    socket.to(roomId).emit('clear', data);
  });

  // TIMER EVENTS
  // Request current timer state (when client connects)
  socket.on('timer_request_sync', (data) => {
    const roomId = data.roomId || socket.roomId || 'global';
    const timerState = getOrCreateTimerState(roomId);
    
    // Send current state to requesting client
    socket.emit('timer_state', {
      timeLeft: timerState.timeLeft,
      isRunning: timerState.isRunning,
      isBreak: timerState.isBreak,
      sessions: timerState.sessions,
      focusMinutes: timerState.focusMinutes,
      breakMinutes: timerState.breakMinutes
    });
  });

  // Timer start event
  socket.on('timer_start', (data) => {
    const roomId = data.roomId || socket.roomId || 'global';
    console.log(`Timer start requested by ${socket.id} in room ${roomId}`);
    
    // Send immediate feedback to all clients
    io.to(roomId).emit('timer_started');
    
    startTimer(roomId);
  });

  // Timer pause event
  socket.on('timer_pause', (data) => {
    const roomId = data.roomId || socket.roomId || 'global';
    console.log(`Timer pause requested by ${socket.id} in room ${roomId}`);
    
    // Send immediate feedback to all clients
    io.to(roomId).emit('timer_paused');
    
    pauseTimer(roomId);
  });

  // Timer reset event
  socket.on('timer_reset', (data) => {
    const roomId = data.roomId || socket.roomId || 'global';
    console.log(`Timer reset requested by ${socket.id} in room ${roomId}`);
    resetTimer(roomId);
  });

  // Timer skip event
  socket.on('timer_skip', (data) => {
    const roomId = data.roomId || socket.roomId || 'global';
    console.log(`Timer skip requested by ${socket.id} in room ${roomId}`);
    skipTimer(roomId);
  });

  // Timer settings update event
  socket.on('timer_settings_update', (data) => {
    const roomId = data.roomId || socket.roomId || 'global';
    const timerState = getOrCreateTimerState(roomId);
    
    timerState.focusMinutes = data.focusMinutes;
    timerState.breakMinutes = data.breakMinutes;
    
    // If timer is not running and we're in focus mode, update the time
    if (!timerState.isRunning && !timerState.isBreak) {
      timerState.timeLeft = data.focusMinutes * 60;
    }
    // If timer is not running and we're in break mode, update the time
    if (!timerState.isRunning && timerState.isBreak) {
      timerState.timeLeft = data.breakMinutes * 60;
    }
    
    broadcastTimerState(roomId);
    console.log(`Timer settings updated in room ${roomId}: focus=${data.focusMinutes}min, break=${data.breakMinutes}min`);
  });

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Whiteboard server with Pomodoro sync listening on ${PORT}`);
});