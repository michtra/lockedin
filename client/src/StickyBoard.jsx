import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function StickyNote({ note, onEdit, onDelete, onDragStart }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const textareaRef = useRef(null);

  function startEdit() {
    setDraft(note.text);
    setEditing(true);
    // Focus happens after render
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed) {
      onEdit(note.id, trimmed);
    } else {
      setDraft(note.text);
    }
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === 'Escape') {
      setDraft(note.text);
      setEditing(false);
    }
  }

  return (
    <div
      className="sticky-note"
      draggable={!editing}
      onDragStart={(e) => {
        if (!editing) onDragStart(e, note.id);
      }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          className="sticky-note-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <p className="sticky-note-text" onClick={startEdit}>
          {note.text}
        </p>
      )}
      <button
        className="sticky-note-delete"
        onClick={() => onDelete(note.id)}
        title="Delete note"
      >
        x
      </button>
    </div>
  );
}

function AddNoteForm({ onAdd }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  function openForm() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText('');
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setText('');
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button className="add-note-btn" onClick={openForm}>
        + Add Note
      </button>
    );
  }

  return (
    <div className="add-note-form">
      <textarea
        ref={inputRef}
        className="add-note-textarea"
        placeholder="Type your note... (Enter to save)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="add-note-actions">
        <button className="add-note-save" onClick={handleSave}>Save</button>
        <button className="add-note-cancel" onClick={() => { setText(''); setOpen(false); }}>Cancel</button>
      </div>
    </div>
  );
}

export default function StickyBoard({ roomId }) {
  const [notes, setNotes] = useState([]);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const draggingId = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SERVER_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('join', roomId);
      socket.emit('request-room-state', roomId);
    });

    socket.on('room-state', (data) => {
      if (data.notes) setNotes(data.notes);
    });

    socket.on('note-add', (note) => {
      setNotes(prev => [...prev, note]);
    });

    socket.on('note-edit', ({ id, text }) => {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
    });

    socket.on('note-move', ({ id, column }) => {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, column } : n));
    });

    socket.on('note-delete', ({ id }) => {
      setNotes(prev => prev.filter(n => n.id !== id));
    });

    return () => socket.disconnect();
  }, [roomId]);

  function addNote(column, text) {
    const note = { id: generateId(), text, column };
    setNotes(prev => [...prev, note]);
    socketRef.current?.emit('note-add', { roomId, note });
  }

  function editNote(id, text) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
    socketRef.current?.emit('note-edit', { roomId, id, text });
  }

  function deleteNote(id) {
    setNotes(prev => prev.filter(n => n.id !== id));
    socketRef.current?.emit('note-delete', { roomId, id });
  }

  function handleDragStart(e, id) {
    draggingId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, column) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  }

  function handleDrop(e, column) {
    e.preventDefault();
    const id = draggingId.current;
    if (!id) return;
    setNotes(prev => prev.map(n => n.id === id ? { ...n, column } : n));
    socketRef.current?.emit('note-move', { roomId, id, column });
    draggingId.current = null;
    setDragOverColumn(null);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDragEnd() {
    draggingId.current = null;
    setDragOverColumn(null);
  }

  const todoNotes = notes.filter((n) => n.column === 'todo');
  const doneNotes = notes.filter((n) => n.column === 'done');

  return (
    <div className="sticky-board">
      <div className="sticky-board-header">
        <h2 className="sticky-board-title">Feynman Topics</h2>
      </div>
      <div className="sticky-columns">
        <div
          className={`sticky-column${dragOverColumn === 'todo' ? ' sticky-column--drag-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'todo')}
          onDrop={(e) => handleDrop(e, 'todo')}
          onDragLeave={handleDragLeave}
        >
          <div className="sticky-column-header">
            <span className="sticky-column-title">To Discuss</span>
            <span className="sticky-column-count">{todoNotes.length}</span>
          </div>
          <div className="sticky-column-notes">
            {todoNotes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                onEdit={editNote}
                onDelete={deleteNote}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
          <AddNoteForm onAdd={(text) => addNote('todo', text)} />
        </div>

        <div
          className={`sticky-column${dragOverColumn === 'done' ? ' sticky-column--drag-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'done')}
          onDrop={(e) => handleDrop(e, 'done')}
          onDragLeave={handleDragLeave}
        >
          <div className="sticky-column-header">
            <span className="sticky-column-title">Discussed</span>
            <span className="sticky-column-count">{doneNotes.length}</span>
          </div>
          <div className="sticky-column-notes">
            {doneNotes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                onEdit={editNote}
                onDelete={deleteNote}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
          <AddNoteForm onAdd={(text) => addNote('done', text)} />
        </div>
      </div>
    </div>
  );
}
