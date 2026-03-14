import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

// Palette of background colors for generated avatars
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

function generateAvatarDataUrl(name, color) {
  const initials = getInitials(name || '?');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="24" fill="${color}" />
    <text x="24" y="24" dy="0.35em" text-anchor="middle" fill="white"
      font-family="system-ui, -apple-system, Arial, sans-serif"
      font-size="18" font-weight="600">${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

function pickRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export default function MemberList({ roomId }) {
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const [clientId] = useState(() => Math.random().toString(36).slice(2, 9));
  const [members, setMembers] = useState([]);
  const [myMember, setMyMember] = useState(null);

  useEffect(() => {
    // Prompt for name
    let name = window.prompt('Enter your name for this session:');
    if (!name || !name.trim()) name = 'Anonymous';
    name = name.trim();

    const color = pickRandomColor();
    const avatar = generateAvatarDataUrl(name, color);

    const member = { id: clientId, name, avatar, color };
    setMyMember(member);

    socketRef.current = io(SERVER_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('join', roomId);
      socket.emit('member-join', { roomId, member });
    });

    socket.on('member-list', (list) => {
      setMembers(list);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, clientId]);

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !myMember) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const newAvatar = ev.target.result;
      // Replace the stored avatar data URL (old one is simply discarded client-side)
      const updated = { ...myMember, avatar: newAvatar };
      setMyMember(updated);
      socketRef.current.emit('member-update', { roomId, member: updated });
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected if needed
    e.target.value = '';
  }

  return (
    <div className="member-list">
      <div className="member-list-header">
        <span className="member-list-title">Members</span>
        <span className="member-list-count">{members.length}</span>
      </div>
      <ul className="member-list-items">
        {members.map((m) => {
          const isMe = m.id === clientId;
          return (
            <li key={m.id} className={`member-item${isMe ? ' member-item--me' : ''}`}>
              <img
                className="member-avatar"
                src={m.avatar}
                alt={m.name}
                title={m.name}
              />
              <span className="member-name">
                {m.name}
                {isMe && <span className="member-you-badge">you</span>}
              </span>
              {isMe && (
                <>
                  <button
                    className="member-avatar-btn"
                    title="Change avatar"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Edit
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarUpload}
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
