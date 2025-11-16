import React, { useState } from 'react';
import './ScenarioSelector.css';

const scenarios = [
  { id: 'normal', name: 'Normalna Praca', description: 'Wszystkie czujniki w normalnych poziomach' },
  { id: 'singleAlarm', name: 'Alarm w Jednym Pokoju', description: 'Wysoki poziom dymu w Kuchni (Pokój 2)' },
  { id: 'multipleAlarms', name: 'Alarmy w Wielu Pokojach', description: 'Wysokie poziomy dymu w wielu pokojach' },
  { id: 'gradualIncrease', name: 'Stopniowy Wzrost Dymu', description: 'Symulacja stopniowego narastania dymu w Pokoju 1' },
  { id: 'intermittent', name: 'Przerywane Skoki', description: 'Losowe skoki symulujące gotowanie/parę' },
  { id: 'systemTest', name: 'Pełny Test Systemu', description: 'Testowanie sekwencyjne wszystkich stanów czujników' }
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
        <h3>Scenariusze Testowe</h3>
        <p className="scenario-subtitle">Symuluj różne warunki alarmowe</p>
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
          <span>Aktywowanie scenariusza...</span>
        </div>
      )}
    </div>
  );
};

export default ScenarioSelector;
