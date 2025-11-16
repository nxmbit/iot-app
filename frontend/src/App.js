import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import FloorPlan from './components/FloorPlan';
import SensorPanel from './components/SensorPanel';
import AlarmControl from './components/AlarmControl';
import StatusBar from './components/StatusBar';
import HistoryChart from './components/HistoryChart';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';

function App() {
  const [sensors, setSensors] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmSound, setAlarmSound] = useState(false);
  const [systemStatus, setSystemStatus] = useState('normal');
  const [wsConnected, setWsConnected] = useState(false);
  const [sensorHistory, setSensorHistory] = useState({});
  
  const ws = useRef(null);
  const audioRef = useRef(null);
  const reconnectTimeout = useRef(null);

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    
    ws.current = new WebSocket(WS_URL);
    
    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
    
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
    
    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
      // Attempt to reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };
  }, []);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (data) => {
    switch(data.type) {
      case 'initial-state':
        setSensors(data.data);
        // Initialize history for each sensor
        const initialHistory = {};
        data.data.forEach(sensor => {
          initialHistory[sensor.roomId] = [];
        });
        setSensorHistory(initialHistory);
        break;
        
      case 'sensor-update':
        setSensors(prevSensors => 
          prevSensors.map(s => 
            s.roomId === data.roomId ? data.data : s
          )
        );
        
        // Update history (keep last 60 readings)
        setSensorHistory(prev => ({
          ...prev,
          [data.roomId]: [
            ...(prev[data.roomId] || []).slice(-59),
            {
              time: new Date().toLocaleTimeString(),
              value: data.data.smokeLevel
            }
          ]
        }));
        break;
        
      case 'alarm-trigger':
        setAlarmActive(true);
        setAlarmSound(true);
        setSystemStatus('alarm');
        playAlarmSound();
        showNotification(`ALARM: High smoke detected in ${data.roomId}!`);
        break;
        
      case 'alarm-clear':
        // Check if any other alarms are still active
        setSensors(prevSensors => {
          const hasActiveAlarms = prevSensors.some(s => 
            s.roomId !== data.roomId && s.isAlarmActive
          );
          if (!hasActiveAlarms) {
            setAlarmActive(false);
            setAlarmSound(false);
            setSystemStatus('normal');
            stopAlarmSound();
          }
          return prevSensors;
        });
        break;
        
      case 'alarm-silence':
        setAlarmSound(false);
        stopAlarmSound();
        break;
        
      case 'alarm-test':
        playAlarmSound();
        setTimeout(() => stopAlarmSound(), 3000);
        break;
        
      default:
        break;
    }
  };

  // Play alarm sound
  const playAlarmSound = () => {
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.play().catch(err => {
        console.error('Error playing alarm sound:', err);
      });
    }
  };

  // Stop alarm sound
  const stopAlarmSound = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // Show browser notification
  const showNotification = (message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Smart Building Alert', {
        body: message,
        icon: '/alarm-icon.png'
      });
    }
  };

  // Send command via WebSocket
  const sendCommand = (command) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(command));
    }
  };

  // Reset alarm for a specific room
  const resetAlarm = (roomId) => {
    sendCommand({ type: 'reset-alarm', roomId });
  };

  // Silence all alarms
  const silenceAlarms = () => {
    setAlarmSound(false);
    stopAlarmSound();
    sensors.forEach(sensor => {
      if (sensor.isAlarmActive) {
        sendCommand({ type: 'silence-alarm', roomId: sensor.roomId });
      }
    });
  };

  // Update sensor threshold
  const updateThreshold = (roomId, threshold) => {
    sendCommand({ type: 'update-threshold', roomId, threshold });
  };

  // Test alarm for a room
  const testAlarm = (roomId) => {
    sendCommand({ type: 'test-alarm', roomId });
  };

  // Fetch initial data
  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Connect to WebSocket
    connectWebSocket();
    
    // Fetch initial sensor data
    axios.get(`${API_URL}/api/sensors`)
      .then(response => {
        setSensors(response.data);
      })
      .catch(error => {
        console.error('Error fetching sensors:', error);
      });
    
    // Cleanup on unmount
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connectWebSocket]);

  // Calculate statistics
  const stats = {
    totalSensors: sensors.length,
    activeAlarms: sensors.filter(s => s.isAlarmActive).length,
    warnings: sensors.filter(s => s.status === 'warning').length,
    averageSmokeLevel: sensors.length > 0
      ? (sensors.reduce((sum, s) => sum + s.smokeLevel, 0) / sensors.length).toFixed(1)
      : 0
  };

  return (
    <div className="App">
      {/* Hidden audio element for alarm sound */}
      <audio ref={audioRef} src="/alarm.mp3" />
      
      {/* Status Bar */}
      <StatusBar 
        systemStatus={systemStatus}
        wsConnected={wsConnected}
        stats={stats}
      />
      
      {/* Main Container */}
      <div className="main-container">
        {/* Left Panel - Floor Plan */}
        <div className="left-panel">
          <div className="panel-header">
            <h2>Building Floor Plan</h2>
            {alarmActive && (
              <div className="alarm-indicator">
                🚨 ALARM ACTIVE
              </div>
            )}
          </div>
          <FloorPlan 
            sensors={sensors}
            selectedRoom={selectedRoom}
            onRoomSelect={setSelectedRoom}
          />
        </div>
        
        {/* Right Panel - Controls and Info */}
        <div className="right-panel">
          {/* Alarm Controls */}
          <AlarmControl
            alarmActive={alarmActive}
            alarmSound={alarmSound}
            onSilence={silenceAlarms}
            onTest={() => testAlarm(selectedRoom || 'room1')}
          />
          
          {/* Selected Sensor Details */}
          {selectedRoom && (
            <>
              <SensorPanel
                sensor={sensors.find(s => s.roomId === selectedRoom)}
                onReset={() => resetAlarm(selectedRoom)}
                onUpdateThreshold={(threshold) => updateThreshold(selectedRoom, threshold)}
                onTest={() => testAlarm(selectedRoom)}
              />
              
              <HistoryChart
                data={sensorHistory[selectedRoom] || []}
                threshold={sensors.find(s => s.roomId === selectedRoom)?.threshold || 50}
                roomName={sensors.find(s => s.roomId === selectedRoom)?.roomName}
              />
            </>
          )}
          
          {/* Sensor List */}
          <div className="sensor-list">
            <h3>All Sensors</h3>
            <div className="sensor-grid">
              {sensors.map(sensor => (
                <div 
                  key={sensor.roomId}
                  className={`sensor-card ${sensor.status} ${selectedRoom === sensor.roomId ? 'selected' : ''}`}
                  onClick={() => setSelectedRoom(sensor.roomId)}
                >
                  <div className="sensor-name">{sensor.roomName}</div>
                  <div className="sensor-value">
                    {sensor.smokeLevel.toFixed(1)}%
                  </div>
                  <div className={`sensor-status status-${sensor.status}`}>
                    {sensor.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
