import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';
const DEFAULT_FOCUS = 25;
const DEFAULT_BREAK = 5;

export default function PomodoroTimer({ roomId }) {
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK);
  const [mode, setMode] = useState('focus');
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_FOCUS * 60);
  const [status, setStatus] = useState('stopped');

  const socketRef = useRef(null);
  const intervalRef = useRef(null);
  const isSyncingRef = useRef(false); // prevent emit loops

  useEffect(() => {
    socketRef.current = io(SERVER_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('join', roomId);
      socket.emit('request-room-state', roomId);
    });

    socket.on('room-state', (data) => {
      if (!data.timer) return;
      applyTimerState(data.timer);
    });

    socket.on('timer-sync', (timer) => {
      isSyncingRef.current = true;
      applyTimerState(timer);
      isSyncingRef.current = false;
    });

    return () => socket.disconnect();
  }, [roomId]);

  function applyTimerState(timer) {
    let sLeft = timer.secondsLeft;

    // If timer is running, account for elapsed time since startedAt
    if (timer.status === 'running' && timer.startedAt) {
      const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
      sLeft = Math.max(0, timer.secondsLeft - elapsed);
    }

    setFocusMinutes(timer.focusMinutes);
    setBreakMinutes(timer.breakMinutes);
    setMode(timer.mode);
    setSecondsLeft(sLeft);
    setStatus(timer.status);
  }

  // Tick logic
  useEffect(() => {
    if (status !== 'running') {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setMode(currentMode => {
            const nextMode = currentMode === 'focus' ? 'break' : 'focus';
            const nextSeconds = nextMode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
            setSecondsLeft(nextSeconds);
            // Broadcast mode switch
            emit('tick', { secondsLeft: nextSeconds, mode: nextMode });
            return nextMode;
          });
          return 0;
        }
        // Sync server every 5 seconds so late joiners get a close approximation
        if ((prev - 1) % 5 === 0) {
          emit('tick', { secondsLeft: prev - 1 });
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [status, focusMinutes, breakMinutes]);

  function emit(action, payload) {
    if (isSyncingRef.current) return;
    socketRef.current?.emit('timer-action', { roomId, action, payload });
  }

  function handleStart() {
    setStatus('running');
    emit('start', { secondsLeft, mode });
  }

  function handlePause() {
    setStatus('paused');
    emit('pause', { secondsLeft });
  }

  function handleResume() {
    setStatus('running');
    emit('resume', { secondsLeft, mode });
  }

  function handleStop() {
    setStatus('stopped');
    setMode('focus');
    setSecondsLeft(focusMinutes * 60);
    emit('stop');
  }

  function handleFocusChange(e) {
    const val = Math.max(1, parseInt(e.target.value) || 1);
    setFocusMinutes(val);
    const newSecs = mode === 'focus' && status === 'stopped' ? val * 60 : secondsLeft;
    if (mode === 'focus' && status === 'stopped') setSecondsLeft(newSecs);
    emit('settings', { focusMinutes: val, breakMinutes, secondsLeft: newSecs });
  }

  function handleBreakChange(e) {
    const val = Math.max(1, parseInt(e.target.value) || 1);
    setBreakMinutes(val);
    const newSecs = mode === 'break' && status === 'stopped' ? val * 60 : secondsLeft;
    if (mode === 'break' && status === 'stopped') setSecondsLeft(newSecs);
    emit('settings', { focusMinutes, breakMinutes: val, secondsLeft: newSecs });
  }

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <div className="pomodoro-panel">
      <h2 className="pomodoro-title">Pomodoro</h2>

      <div className={`pomodoro-mode-badge ${mode === 'focus' ? 'mode-focus' : 'mode-break'}`}>
        {mode === 'focus' ? 'Focus' : 'Break'}
      </div>

      <div className="pomodoro-display">
        {minutes}:{seconds}
      </div>

      <div className="pomodoro-controls">
        {status === 'stopped' && (
          <button className="pomo-btn pomo-btn-start" onClick={handleStart}>
            Start
          </button>
        )}
        {status === 'running' && (
          <button className="pomo-btn pomo-btn-pause" onClick={handlePause}>
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button className="pomo-btn pomo-btn-start" onClick={handleResume}>
            Resume
          </button>
        )}
        {status !== 'stopped' && (
          <button className="pomo-btn pomo-btn-stop" onClick={handleStop}>
            Stop
          </button>
        )}
      </div>

      <div className="pomodoro-settings">
        <label className="pomo-setting-label">
          Focus (min)
          <input
            type="number"
            min="1"
            value={focusMinutes}
            onChange={handleFocusChange}
            disabled={status !== 'stopped'}
            className="pomo-input"
          />
        </label>
        <label className="pomo-setting-label">
          Break (min)
          <input
            type="number"
            min="1"
            value={breakMinutes}
            onChange={handleBreakChange}
            disabled={status !== 'stopped'}
            className="pomo-input"
          />
        </label>
      </div>

      {status !== 'stopped' && (
        <p className="pomo-settings-note">Stop the timer to adjust durations.</p>
      )}
    </div>
  );
}
