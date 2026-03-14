import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { generateAvatarDataUrl } from './App';

const SERVER_URL = 'http://localhost:3000';

export default function MemberList({ roomId, myMember, onMemberUpdate }) {
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    socketRef.current = io(SERVER_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('join', roomId);
      socket.emit('member-join', { roomId, member: myMember });
    });

    socket.on('member-list', (list) => {
      setMembers(list);
    });

    return () => socket.disconnect();
  }, [roomId, myMember.id]);

  function emitUpdate(updated) {
    onMemberUpdate(updated);
    socketRef.current?.emit('member-update', { roomId, member: updated });
  }

  function handleEditOpen() {
    setDraftName(myMember.name);
    setEditing(true);
  }

  function handleEditSave() {
    const name = draftName.trim() || myMember.name;
    const avatar = generateAvatarDataUrl(name, myMember.color);
    emitUpdate({ ...myMember, name, avatar });
    setEditing(false);
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') handleEditSave();
    if (e.key === 'Escape') setEditing(false);
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      emitUpdate({ ...myMember, avatar: ev.target.result });
    };
    reader.readAsDataURL(file);
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
          const isMe = m.id === myMember.id;
          return (
            <li key={m.id} className={`member-item${isMe ? ' member-item--me' : ''}`}>
              <img className="member-avatar" src={m.avatar} alt={m.name} title={m.name} />
              {isMe && editing ? (
                <input
                  className="member-name-input"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={handleEditSave}
                  autoFocus
                />
              ) : (
                <span className="member-name">
                  {m.name}
                  {isMe && <span className="member-you-badge">you</span>}
                </span>
              )}
              {isMe && !editing && (
                <div className="member-actions">
                  <button className="member-action-btn" onClick={handleEditOpen} title="Edit name">
                    Rename
                  </button>
                  <button className="member-action-btn" onClick={() => fileInputRef.current?.click()} title="Change avatar">
                    Avatar
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarUpload}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
