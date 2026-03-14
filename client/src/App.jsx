import React, { useState, useEffect } from 'react'
import Whiteboard from './Whiteboard'
import PomodoroTimer from './PomodoroTimer'
import StickyBoard from './StickyBoard'
import MemberList from './MemberList'

async function generateRoomId() {
  const timestamp = Date.now().toString();
  const encoded = new TextEncoder().encode(timestamp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function getRoomIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

export default function App() {
  const [roomId, setRoomId] = useState(() => getRoomIdFromUrl());
  const [copied, setCopied] = useState(false);

  async function handleCreateSession() {
    const id = await generateRoomId();
    const url = new URL(window.location.href);
    url.searchParams.set('room', id);
    window.history.pushState({}, '', url);
    setRoomId(id);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!roomId) {
    return (
      <div className="landing">
        <div className="landing-card">
          <h1>LockedIn</h1>
          <p>Create a session and share the link with your study group.</p>
          <button className="create-btn" onClick={handleCreateSession}>
            Create Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="session-bar">
        <span className="session-label">Session: <code>{roomId}</code></span>
        <button onClick={handleCopyLink}>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
      <div className="session-body">
        <PomodoroTimer />
        <Whiteboard roomId={roomId} />
        <div className="session-sidebar">
          <MemberList roomId={roomId} />
          <div className="sticky-board-panel">
            <StickyBoard />
          </div>
        </div>
      </div>
    </div>
  );
}
