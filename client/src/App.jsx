import React, { useState, useEffect } from 'react'
import Whiteboard from './Whiteboard'
import PomodoroTimer from './PomodoroTimer'
import StickyBoard from './StickyBoard'
import MemberList from './MemberList'
import ProgressChart from './ProgressChart'

const AVATAR_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#00bcd4', '#ff5722', '#607d8b', '#795548'
];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function generateAvatarDataUrl(name, color) {
  const initials = getInitials(name || '?');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="24" fill="${color}" />
    <text x="24" y="24" dy="0.35em" text-anchor="middle" fill="white"
      font-family="system-ui, -apple-system, Arial, sans-serif"
      font-size="18" font-weight="600">${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

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
  const [myMember, setMyMember] = useState(null);

  useEffect(() => {
    if (!roomId) return;
    let name = window.prompt('Enter your name for this session:');
    if (!name?.trim()) name = 'Anonymous';
    name = name.trim();
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const avatar = generateAvatarDataUrl(name, color);
    setMyMember({ id: Math.random().toString(36).slice(2, 9), name, avatar, color });
  }, [roomId]);

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

  if (!myMember) return null;

  return (
    <div className="app">
      <div className="session-bar">
        <span className="session-label">Session: <code>{roomId}</code></span>
        <button onClick={handleCopyLink}>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
      <div className="session-body">
        <PomodoroTimer roomId={roomId} />
        <Whiteboard roomId={roomId} />
        <div className="session-sidebar">
          <MemberList roomId={roomId} myMember={myMember} onMemberUpdate={setMyMember} />
          <ProgressChart roomId={roomId} />
          <div className="sticky-board-panel">
            <StickyBoard roomId={roomId} member={myMember} />
          </div>
        </div>
      </div>
    </div>
  );
}
