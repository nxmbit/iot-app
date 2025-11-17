import React, { useState } from 'react';
import './ControlPanel.css';

const ControlPanel = ({ selectedRoom, onControlAction }) => {
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState('');

  const handleAction = async (action, label) => {
    setLoading(true);
    setActiveAction(action);

    try {
      await onControlAction(action);
    } finally {
      setLoading(false);
      setTimeout(() => setActiveAction(''), 2000);
    }
  };

  return (
    <div className="control-panel">
      <div className="control-header">
        <h3>Panel Kontrolny</h3>
        <p className="control-subtitle">Ręczne sterowanie alarmami</p>
      </div>

      <div className="control-section">
        <h4>Alarm w wybranym pokoju</h4>
        <button
          className={`control-btn alarm-btn ${activeAction === 'trigger-room' ? 'active' : ''}`}
          onClick={() => handleAction('trigger-room', 'Alarm w pokoju')}
          disabled={!selectedRoom || loading}
          title={selectedRoom ? `Uruchom alarm w ${selectedRoom}` : 'Wybierz pokój'}
        >
          <span className="btn-icon">🚨</span>
          <span className="btn-text">
            {selectedRoom ? `Alarm w ${selectedRoom}` : 'Wybierz pokój'}
          </span>
        </button>
      </div>

      <div className="control-section">
        <h4>Alarm we wszystkich pokojach</h4>
        <button
          className={`control-btn alarm-all-btn ${activeAction === 'trigger-all' ? 'active' : ''}`}
          onClick={() => handleAction('trigger-all', 'Alarm wszędzie')}
          disabled={loading}
        >
          <span className="btn-icon">🔥</span>
          <span className="btn-text">Uruchom alarm globalny</span>
        </button>
      </div>

      <div className="control-section">
        <h4>Resetuj wybrany pokój</h4>
        <button
          className={`control-btn reset-btn ${activeAction === 'reset-room' ? 'active' : ''}`}
          onClick={() => handleAction('reset-room', 'Reset pokoju')}
          disabled={!selectedRoom || loading}
          title={selectedRoom ? `Resetuj ${selectedRoom}` : 'Wybierz pokój'}
        >
          <span className="btn-icon">🔄</span>
          <span className="btn-text">
            {selectedRoom ? `Resetuj ${selectedRoom}` : 'Wybierz pokój'}
          </span>
        </button>
      </div>

      <div className="control-section">
        <h4>Resetuj wszystkie pokoje</h4>
        <button
          className={`control-btn reset-all-btn ${activeAction === 'reset-all' ? 'active' : ''}`}
          onClick={() => handleAction('reset-all', 'Reset wszystkich')}
          disabled={loading}
        >
          <span className="btn-icon">♻️</span>
          <span className="btn-text">Resetuj wszystko</span>
        </button>
      </div>

      {loading && (
        <div className="control-loading">
          <span className="spinner">⏳</span>
          <span>Wykonywanie akcji...</span>
        </div>
      )}

      {!selectedRoom && (
        <div className="control-hint">
          💡 Wskazówka: Wybierz pokój na planie piętra, aby użyć kontroli dla pojedynczego pokoju
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
