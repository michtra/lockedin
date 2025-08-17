import React, { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'

// Use the same server URL as Whiteboard
const SERVER_URL = 'http://localhost:3000'

export default function PomodoroTimer() {
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [timeLeft, setTimeLeft] = useState(25 * 60) // in seconds
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [sessions, setSessions] = useState(0)
  
  const socketRef = useRef(null)
  const [clientId] = useState(() => Math.random().toString(36).slice(2, 9))
  const roomId = 'global' // Same room as whiteboard

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io(SERVER_URL)
    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('Pomodoro timer connected to server', socket.id)
      socket.emit('join', roomId)
      // Request current timer state when connecting
      socket.emit('timer_request_sync', { roomId, clientId })
    })

    // Listen for timer state updates from server
    socket.on('timer_state', (data) => {
      setTimeLeft(data.timeLeft)
      setIsRunning(data.isRunning)
      setIsBreak(data.isBreak)
      setSessions(data.sessions)
      setFocusMinutes(data.focusMinutes)
      setBreakMinutes(data.breakMinutes)
    })

    // Listen for immediate control responses (for faster UI feedback)
    socket.on('timer_started', () => {
      setIsRunning(true)
    })

    socket.on('timer_paused', () => {
      setIsRunning(false)
    })

    // Listen for timer finished notifications
    socket.on('timer_finished', (data) => {
      playNotificationSound()
      showBrowserNotification(data.sessionType, data.nextSessionType)
    })

    return () => {
      socket.disconnect()
    }
  }, [clientId])

  const showBrowserNotification = (completedSession, nextSession) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = completedSession === 'focus' 
        ? '🍅 Focus Session Complete!' 
        : '☕ Break Time Over!'
      
      const body = nextSession === 'focus'
        ? 'Time to get back to work! 🎯'
        : 'Great work! Time for a break! ☕'
      
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico', // You can add a custom icon
        badge: '/favicon.ico',
        tag: 'pomodoro-timer', // Prevents notification spam
        requireInteraction: false,
        silent: false
      })

      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close()
      }, 5000)
    }
  }

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      
      // Create a more pleasant notification sound
      const oscillator1 = audioContext.createOscillator()
      const oscillator2 = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator1.connect(gainNode)
      oscillator2.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // Two-tone chime
      oscillator1.frequency.value = 800
      oscillator2.frequency.value = 600
      oscillator1.type = 'sine'
      oscillator2.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1)
      
      oscillator1.start()
      oscillator2.start()
      oscillator1.stop(audioContext.currentTime + 1)
      oscillator2.stop(audioContext.currentTime + 1)
    } catch (error) {
      console.log('Timer finished!')
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStart = () => {
    if (socketRef.current) {
      socketRef.current.emit('timer_start', {
        roomId,
        clientId
      })
    }
  }

  const handlePause = () => {
    if (socketRef.current) {
      socketRef.current.emit('timer_pause', {
        roomId,
        clientId
      })
    }
  }

  const handleReset = () => {
    if (socketRef.current) {
      socketRef.current.emit('timer_reset', {
        roomId,
        clientId
      })
    }
  }

  const handleSkip = () => {
    if (socketRef.current) {
      socketRef.current.emit('timer_skip', {
        roomId,
        clientId
      })
    }
  }

  const handleFocusMinutesChange = (newMinutes) => {
    const minutes = Math.max(1, parseInt(newMinutes) || 25)
    if (socketRef.current) {
      socketRef.current.emit('timer_settings_update', {
        roomId,
        clientId,
        focusMinutes: minutes,
        breakMinutes
      })
    }
  }

  const handleBreakMinutesChange = (newMinutes) => {
    const minutes = Math.max(1, parseInt(newMinutes) || 5)
    if (socketRef.current) {
      socketRef.current.emit('timer_settings_update', {
        roomId,
        clientId,
        focusMinutes,
        breakMinutes: minutes
      })
    }
  }

  return (
    <div className="pomodoro-timer">
      <div className="timer-header">
        <h2>🍅 Pomodoro Timer</h2>
        <div className="session-info">
          <span className="session-type">
            {isBreak ? '☕ Break Time' : '🎯 Focus Time'}
          </span>
          <span className="session-count">Sessions: {sessions}</span>
        </div>
        <div className="sync-indicator">
          🔄 Synced
        </div>
      </div>

      <div className="timer-display">
        <div className={`time ${isBreak ? 'break-time' : 'focus-time'}`}>
          {formatTime(timeLeft)}
        </div>
        <div className="progress-bar">
          <div 
            className={`progress-fill ${isBreak ? 'break-progress' : 'focus-progress'}`}
            style={{
              width: `${((isBreak ? breakMinutes * 60 : focusMinutes * 60) - timeLeft) / (isBreak ? breakMinutes * 60 : focusMinutes * 60) * 100}%`
            }}
          ></div>
        </div>
      </div>

      <div className="timer-controls">
        {!isRunning ? (
          <button onClick={handleStart} className="btn btn-start">
            ▶️ Start
          </button>
        ) : (
          <button onClick={handlePause} className="btn btn-pause">
            ⏸️ Pause
          </button>
        )}
        <button onClick={handleReset} className="btn btn-reset">
          🔄 Reset
        </button>
        <button onClick={handleSkip} className="btn btn-skip">
          ⏭️ Skip
        </button>
      </div>

      <div className="timer-settings">
        <div className="setting-group">
          <label htmlFor="focus-minutes">Focus Minutes:</label>
          <input
            id="focus-minutes"
            type="number"
            min="1"
            max="60"
            value={focusMinutes}
            onChange={(e) => handleFocusMinutesChange(e.target.value)}
            disabled={isRunning}
          />
        </div>
        <div className="setting-group">
          <label htmlFor="break-minutes">Break Minutes:</label>
          <input
            id="break-minutes"
            type="number"
            min="1"
            max="30"
            value={breakMinutes}
            onChange={(e) => handleBreakMinutesChange(e.target.value)}
            disabled={isRunning}
          />
        </div>
      </div>
    </div>
  )
}