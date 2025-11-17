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
          <h3>Status Systemu</h3>
          <p>{alarmActive ? 'AKTYWNY ALARM' : 'Wszystkie Systemy Normalne'}</p>
        </div>
      </div>

      <div className="alarm-actions">
        <button
          onClick={onSilence}
          className="btn-control silence"
          disabled={!alarmActive || !alarmSound}
        >
          <span className="icon">🔇</span>
          <span>Wycisz Alarm</span>
        </button>

        <button
          onClick={onTest}
          className="btn-control test"
        >
          <span className="icon">🔔</span>
          <span>Testuj System</span>
        </button>
      </div>
    </div>
  );
};

export default AlarmControl;
