import React, { useState } from 'react';
import './SensorPanel.css';

const SensorPanel = ({ sensor, onReset, onUpdateThreshold, onTest, onSetSmokeLevel }) => {
  const [threshold, setThreshold] = useState(sensor?.threshold || 50);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSmoke, setIsEditingSmoke] = useState(false);
  const [manualSmokeLevel, setManualSmokeLevel] = useState(sensor?.smokeLevel || 0);

  if (!sensor) return null;

  const handleThresholdUpdate = () => {
    onUpdateThreshold(threshold);
    setIsEditing(false);
  };

  const handleSmokeLevelUpdate = () => {
    onSetSmokeLevel(manualSmokeLevel);
    setIsEditingSmoke(false);
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
          <label>Poziom Dymu {sensor.isManuallySet && <span className="manual-badge">🎮 Ręczny</span>}</label>
          <div className="metric-value" style={{ color: sensor.smokeLevel > sensor.threshold ? '#e74c3c' : '#2c3e50' }}>
            {sensor.smokeLevel.toFixed(1)}%
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
          {isEditingSmoke ? (
            <div className="smoke-edit">
              <input
                type="range"
                min="0"
                max="100"
                value={manualSmokeLevel}
                onChange={(e) => setManualSmokeLevel(Number(e.target.value))}
                className="smoke-slider"
              />
              <span className="smoke-value">{manualSmokeLevel}%</span>
              <button onClick={handleSmokeLevelUpdate} className="btn btn-small btn-primary">
                Ustaw
              </button>
              <button onClick={() => setIsEditingSmoke(false)} className="btn btn-small">
                Anuluj
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setManualSmokeLevel(sensor.smokeLevel);
                setIsEditingSmoke(true);
              }}
              className="btn btn-small btn-manual"
            >
              📊 Ustaw Ręcznie
            </button>
          )}
        </div>

        <div className="metric">
          <label>Status</label>
          <div className="status-badge" style={{ backgroundColor: getStatusColor() }}>
            {sensor.status.toUpperCase()}
          </div>
        </div>

        <div className="metric">
          <label>Próg Alarmu</label>
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
                Zapisz
              </button>
              <button onClick={() => setIsEditing(false)} className="btn btn-small">
                Anuluj
              </button>
            </div>
          ) : (
            <div className="threshold-display">
              <span className="metric-value">{sensor.threshold}%</span>
              <button onClick={() => setIsEditing(true)} className="btn btn-small">
                Edytuj
              </button>
            </div>
          )}
        </div>

        <div className="metric">
          <label>Ostatnia Aktualizacja</label>
          <div className="timestamp">
            {new Date(sensor.lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="sensor-actions">
        <button
          onClick={onReset}
          className="btn btn-success"
          disabled={!sensor.isAlarmActive}
        >
          Resetuj Alarm
        </button>
        <button
          onClick={onTest}
          className="btn btn-warning"
        >
          Testuj Alarm
        </button>
      </div>

      {sensor.isAlarmActive && (
        <div className="alarm-warning">
          ⚠️ AKTYWNY ALARM - Wykryto wysoki poziom dymu!
        </div>
      )}
    </div>
  );
};

export default SensorPanel;
