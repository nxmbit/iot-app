import React, { useState } from 'react';
import './ScenarioSelector.css';

const scenarios = [
  { id: 'normal', name: 'Normal Operation', description: 'All sensors reading normal levels' },
  { id: 'singleAlarm', name: 'Single Room Alarm', description: 'High smoke level in Kitchen (Room 2)' },
  { id: 'multipleAlarms', name: 'Multiple Room Alarms', description: 'High smoke levels in multiple rooms' },
  { id: 'gradualIncrease', name: 'Gradual Smoke Increase', description: 'Simulating gradual smoke buildup in Room 1' },
  { id: 'intermittent', name: 'Intermittent Spikes', description: 'Random spikes simulating cooking/steam' },
  { id: 'systemTest', name: 'Full System Test', description: 'Testing all sensor states sequentially' }
];

const ScenarioSelector = ({ onScenarioChange }) => {
  const [selectedScenario, setSelectedScenario] = useState('');
  const [loading, setLoading] = useState(false);

  const handleScenarioChange = async (scenarioId) => {
    if (!scenarioId) return;

    setSelectedScenario(scenarioId);
    setLoading(true);

    try {
      await onScenarioChange(scenarioId);
    } finally {
      setLoading(false);
      // Reset selection after a delay
      setTimeout(() => setSelectedScenario(''), 2000);
    }
  };

  return (
    <div className="scenario-selector">
      <div className="scenario-header">
        <h3>Test Scenarios</h3>
        <p className="scenario-subtitle">Simulate different alarm conditions</p>
      </div>

      <div className="scenario-list">
        {scenarios.map(scenario => (
          <button
            key={scenario.id}
            className={`scenario-btn ${selectedScenario === scenario.id ? 'active' : ''}`}
            onClick={() => handleScenarioChange(scenario.id)}
            disabled={loading}
          >
            <div className="scenario-name">{scenario.name}</div>
            <div className="scenario-description">{scenario.description}</div>
          </button>
        ))}
      </div>

      {loading && (
        <div className="scenario-loading">
          <span className="spinner">⏳</span>
          <span>Activating scenario...</span>
        </div>
      )}
    </div>
  );
};

export default ScenarioSelector;
