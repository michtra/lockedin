import React from 'react'
import Whiteboard from './Whiteboard'
import PomodoroTimer from './PomodoroTimer'

export default function App() {
  return (
    <div className="app">
      <div className="app-header">
        <h1>Collaborative Whiteboard</h1>
        <PomodoroTimer />
      </div>
      <Whiteboard />
    </div>
  )
}