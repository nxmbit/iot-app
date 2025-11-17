import React from 'react';
import './AlarmControl.css';

const AlarmControl = ({ alarmActive, alarmSound, onSilence, onTest, onTriggerGlobalAlarm, onResetGlobalStatus }) => {
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

      <div className="global-controls">
        <h4>Global Controls</h4>
        <div className="global-actions">
          <button
            onClick={onTriggerGlobalAlarm}
            className="btn-control trigger-global"
          >
            <span className="icon">🚨</span>
            <span>Trigger All Alarms</span>
          </button>

          <button
            onClick={onResetGlobalStatus}
            className="btn-control reset-global"
          >
            <span className="icon">🔄</span>
            <span>Reset All Rooms</span>
          </button>
        </div>
      </div>

      {alarmActive && (
        <div className="emergency-info">
          <h4>Emergency Procedures:</h4>
          <ol>
            <li>Evacuate the building immediately</li>
            <li>Call emergency services: 911</li>
            <li>Meet at designated assembly point</li>
            <li>Do not re-enter until all clear</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default AlarmControl;
