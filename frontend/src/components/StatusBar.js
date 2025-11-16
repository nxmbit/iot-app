import React from 'react';
import './StatusBar.css';

const StatusBar = ({ systemStatus, wsConnected, stats }) => {
  const getStatusColor = () => {
    if (systemStatus === 'alarm') return '#e74c3c';
    if (stats.warnings > 0) return '#f39c12';
    return '#27ae60';
  };

  return (
    <div className="status-bar" style={{ backgroundColor: getStatusColor() }}>
      <div className="status-bar-content">
        <div className="status-section">
          <h1>Smart Building Alarm System</h1>
        </div>
        
        <div className="status-section stats">
          <div className="stat-item">
            <span className="stat-label">Sensors</span>
            <span className="stat-value">{stats.totalSensors}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Alarms</span>
            <span className="stat-value">{stats.activeAlarms}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Warnings</span>
            <span className="stat-value">{stats.warnings}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Level</span>
            <span className="stat-value">{stats.averageSmokeLevel}%</span>
          </div>
        </div>
        
        <div className="status-section">
          <div className="connection-status">
            <div className={`connection-dot ${wsConnected ? 'connected' : 'disconnected'}`} />
            <span>{wsConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="current-time">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
