import React from 'react';
import './AlarmControl.css';

const AlarmControl = ({ alarmActive, alarmSound, onSilence, onTest }) => {
  return (
    <div className={`alarm-control ${alarmActive ? 'active' : ''}`}>
      <div className="alarm-status">
        <div className="status-icon">
          {alarmActive ? (
            <span className="alarm-icon">🚨</span>
          ) : (
            <span className="safe-icon">✅</span>
          )}
        </div>
        <div className="status-text">
          <h3>System Status</h3>
          <p>{alarmActive ? 'ALARM ACTIVE' : 'All Systems Normal'}</p>
        </div>
      </div>

      <div className="alarm-actions">
        <button
          onClick={onSilence}
          className="btn-control silence"
          disabled={!alarmActive || !alarmSound}
        >
          <span className="icon">🔇</span>
          <span>Silence Alarm</span>
        </button>

        <button
          onClick={onTest}
          className="btn-control test"
        >
          <span className="icon">🔔</span>
          <span>Test System</span>
        </button>
      </div>
    </div>
  );
};

export default AlarmControl;
