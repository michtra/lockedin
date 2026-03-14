import React, { useState, useEffect, useRef } from 'react';

const DEFAULT_FOCUS = 25;
const DEFAULT_BREAK = 5;

export default function PomodoroTimer() {
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK);
  const [mode, setMode] = useState('focus'); // 'focus' | 'break'
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_FOCUS * 60);
  const [status, setStatus] = useState('stopped'); // 'stopped' | 'running' | 'paused'

  const intervalRef = useRef(null);

  // Clear interval on unmount
  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  // Tick logic
  useEffect(() => {
    if (status !== 'running') return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          // Switch modes automatically
          setMode(currentMode => {
            const nextMode = currentMode === 'focus' ? 'break' : 'focus';
            setSecondsLeft(nextMode === 'focus' ? focusMinutes * 60 : breakMinutes * 60);
            return nextMode;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [status, focusMinutes, breakMinutes]);

  function handleStart() {
    setStatus('running');
  }

  function handlePause() {
    setStatus('paused');
  }

  function handleResume() {
    setStatus('running');
  }

  function handleStop() {
    setStatus('stopped');
    setMode('focus');
    setSecondsLeft(focusMinutes * 60);
  }

  function handleFocusChange(e) {
    const val = Math.max(1, parseInt(e.target.value) || 1);
    setFocusMinutes(val);
    if (status === 'stopped' && mode === 'focus') {
      setSecondsLeft(val * 60);
    }
  }

  function handleBreakChange(e) {
    const val = Math.max(1, parseInt(e.target.value) || 1);
    setBreakMinutes(val);
    if (status === 'stopped' && mode === 'break') {
      setSecondsLeft(val * 60);
    }
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
