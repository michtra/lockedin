import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

export default function ProgressChart({ roomId }) {
  const socketRef = useRef(null);
  const [focusSessions, setFocusSessions] = useState(0);
  const [topicsDiscussed, setTopicsDiscussed] = useState(0);

  useEffect(() => {
    socketRef.current = io(SERVER_URL);
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('join', roomId);
      socket.emit('request-room-state', roomId);
    });

    socket.on('room-state', (data) => {
      if (data.progress) {
        setFocusSessions(data.progress.focusSessions ?? 0);
        setTopicsDiscussed(data.progress.topicsDiscussed ?? 0);
      }
      // Derive topicsDiscussed from existing notes if present
      if (data.notes) {
        setTopicsDiscussed(data.notes.filter(n => n.column === 'done').length);
      }
    });

    socket.on('progress-update', (progress) => {
      setFocusSessions(progress.focusSessions);
      setTopicsDiscussed(progress.topicsDiscussed);
    });

    return () => socket.disconnect();
  }, [roomId]);

  const bars = [
    { label: 'Focus Sessions', value: focusSessions, color: '#3498db', max: Math.max(focusSessions, 4) },
    { label: 'Topics Done', value: topicsDiscussed, color: '#2ecc71', max: Math.max(topicsDiscussed, 4) },
  ];

  const barHeight = 28;
  const gap = 16;
  const labelWidth = 110;
  const chartWidth = 160;
  const svgHeight = bars.length * (barHeight + gap);

  return (
    <div className="progress-chart">
      <h3 className="progress-chart-title">Session Progress</h3>
      <svg width="100%" height={svgHeight} viewBox={`0 0 ${labelWidth + chartWidth + 32} ${svgHeight}`}>
        {bars.map(({ label, value, color, max }, i) => {
          const y = i * (barHeight + gap);
          const fillWidth = max === 0 ? 0 : Math.round((value / max) * chartWidth);
          return (
            <g key={label}>
              <text
                x={labelWidth - 6}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="#555"
              >
                {label}
              </text>
              <rect x={labelWidth} y={y} width={chartWidth} height={barHeight} fill="#e9ecef" rx="4" />
              <rect x={labelWidth} y={y} width={fillWidth} height={barHeight} fill={color} rx="4" />
              <text
                x={labelWidth + fillWidth + 6}
                y={y + barHeight / 2}
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="600"
                fill="#333"
              >
                {value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
