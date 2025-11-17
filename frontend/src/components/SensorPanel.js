import React, { useState } from 'react';
import './SensorPanel.css';

const SensorPanel = ({ sensor, onReset, onUpdateThreshold, onTest, onTriggerAlarm, onResetStatus, onSetSmokeLevel }) => {
  const [threshold, setThreshold] = useState(sensor?.threshold || 50);
  const [isEditing, setIsEditing] = useState(false);
  const [manualSmokeLevel, setManualSmokeLevel] = useState(sensor?.smokeLevel || 0);
  const [isEditingSmokeLevel, setIsEditingSmokeLevel] = useState(false);

  if (!sensor) return null;

  const handleThresholdUpdate = () => {
    onUpdateThreshold(threshold);
    setIsEditing(false);
  };

  const handleSmokeLevelUpdate = () => {
    onSetSmokeLevel(manualSmokeLevel);
    setIsEditingSmokeLevel(false);
  };

  const getStatusColor = () => {
    switch(sensor.status) {
      case 'alarm': return '#e74c3c';
      case 'warning': return '#f39c12';
      case 'normal': return '#27ae60';
      default: return '#95a5a6';
    }
  };

  return (
    <div className="sensor-panel">
      <div className="sensor-header">
        <h3>{sensor.roomName}</h3>
        <div className="sensor-id">ID: {sensor.roomId}</div>
      </div>

      <div className="sensor-metrics">
        <div className="metric">
          <label>
            Smoke Level
            {sensor.isManuallySet && <span className="manual-badge"> (Manual)</span>}
          </label>
          {isEditingSmokeLevel ? (
            <div className="smoke-level-edit">
              <input
                type="range"
                min="0"
                max="100"
                value={manualSmokeLevel}
                onChange={(e) => setManualSmokeLevel(Number(e.target.value))}
              />
              <span>{manualSmokeLevel.toFixed(0)}%</span>
              <button onClick={handleSmokeLevelUpdate} className="btn btn-small btn-primary">
                Set
              </button>
              <button onClick={() => setIsEditingSmokeLevel(false)} className="btn btn-small">
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="metric-value" style={{ color: sensor.smokeLevel > sensor.threshold ? '#e74c3c' : '#2c3e50' }}>
                {sensor.smokeLevel.toFixed(1)}%
                <button
                  onClick={() => {
                    setManualSmokeLevel(sensor.smokeLevel);
                    setIsEditingSmokeLevel(true);
                  }}
                  className="btn btn-small btn-inline"
                >
                  Edit
                </button>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(sensor.smokeLevel, 100)}%`,
                    backgroundColor: sensor.smokeLevel > sensor.threshold ? '#e74c3c' : '#3498db'
                  }}
                />
                <div
                  className="threshold-line"
                  style={{ left: `${sensor.threshold}%` }}
                />
              </div>
            </>
          )}
        </div>

        <div className="metric">
          <label>Status</label>
          <div className="status-badge" style={{ backgroundColor: getStatusColor() }}>
            {sensor.status.toUpperCase()}
          </div>
        </div>

        <div className="metric">
          <label>Threshold</label>
          {isEditing ? (
            <div className="threshold-edit">
              <input
                type="range"
                min="10"
                max="90"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span>{threshold}%</span>
              <button onClick={handleThresholdUpdate} className="btn btn-small btn-primary">
                Save
              </button>
              <button onClick={() => setIsEditing(false)} className="btn btn-small">
                Cancel
              </button>
            </div>
          ) : (
            <div className="threshold-display">
              <span className="metric-value">{sensor.threshold}%</span>
              <button onClick={() => setIsEditing(true)} className="btn btn-small">
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="metric">
          <label>Last Update</label>
          <div className="timestamp">
            {new Date(sensor.lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="sensor-actions">
        <div className="action-group">
          <h4>Alarm Control</h4>
          <button
            onClick={onTriggerAlarm}
            className="btn btn-danger"
          >
            Trigger Alarm
          </button>
          <button
            onClick={onTest}
            className="btn btn-warning"
          >
            Test Alarm
          </button>
        </div>
        <div className="action-group">
          <h4>Reset Control</h4>
          <button
            onClick={onReset}
            className="btn btn-info"
            disabled={!sensor.isAlarmActive}
          >
            Reset Alarm Only
          </button>
          <button
            onClick={onResetStatus}
            className="btn btn-success"
          >
            Reset Room (Clear All)
          </button>
        </div>
      </div>

      {sensor.isAlarmActive && (
        <div className="alarm-warning">
          ⚠️ ALARM ACTIVE - High smoke level detected!
        </div>
      )}
    </div>
  );
};

export default SensorPanel;
