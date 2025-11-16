const express = require('express');
const mqtt = require('mqtt');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const winston = require('winston');
require('dotenv').config();

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configuration
const API_PORT = process.env.API_PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

// Data store for sensor states
const sensorData = new Map();
const alarmStates = new Map();

// Room configuration
const rooms = [
  { id: 'room1', name: 'Living Room', x: 10, y: 10, width: 200, height: 150 },
  { id: 'room2', name: 'Kitchen', x: 220, y: 10, width: 150, height: 150 },
  { id: 'room3', name: 'Bedroom 1', x: 380, y: 10, width: 180, height: 150 },
  { id: 'room4', name: 'Bedroom 2', x: 10, y: 170, width: 200, height: 150 },
  { id: 'room5', name: 'Bathroom', x: 220, y: 170, width: 150, height: 150 },
  { id: 'room6', name: 'Office', x: 380, y: 170, width: 180, height: 150 }
];

// Initialize sensor data
rooms.forEach(room => {
  sensorData.set(room.id, {
    roomId: room.id,
    roomName: room.name,
    smokeLevel: 0,
    threshold: 50,
    status: 'normal',
    isAlarmActive: false,
    lastUpdate: new Date().toISOString(),
    position: { x: room.x, y: room.y },
    dimensions: { width: room.width, height: room.height }
  });
});

// MQTT Client Setup
const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
  clientId: `backend_${Math.random().toString(16).slice(3)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});

// WebSocket Server
const wss = new WebSocket.Server({ port: WS_PORT });
const wsClients = new Set();

wss.on('connection', (ws) => {
  logger.info('New WebSocket client connected');
  wsClients.add(ws);

  // Send initial state to new client
  const initialState = {
    type: 'initial-state',
    data: Array.from(sensorData.values()),
    rooms: rooms
  };
  ws.send(JSON.stringify(initialState));

  ws.on('close', () => {
    wsClients.delete(ws);
    logger.info('WebSocket client disconnected');
  });

  ws.on('error', (err) => {
    logger.error('WebSocket error:', err);
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(data);
    } catch (err) {
      logger.error('Invalid WebSocket message:', err);
    }
  });
});

// Handle WebSocket messages from frontend
function handleWebSocketMessage(data) {
  switch(data.type) {
    case 'reset-alarm':
      resetAlarm(data.roomId);
      break;
    case 'update-threshold':
      updateThreshold(data.roomId, data.threshold);
      break;
    case 'silence-alarm':
      silenceAlarm(data.roomId);
      break;
    case 'test-alarm':
      testAlarm(data.roomId);
      break;
  }
}

// Broadcast to all WebSocket clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// MQTT Event Handlers
mqttClient.on('connect', () => {
  logger.info('Connected to MQTT broker');
  
  // Subscribe to all sensor topics
  const topics = [
    'building/+/+/smoke',
    'building/+/+/status',
    'building/system/+',
    'building/+/+/heartbeat'
  ];
  
  mqttClient.subscribe(topics, (err) => {
    if (err) {
      logger.error('MQTT subscription error:', err);
    } else {
      logger.info('Subscribed to MQTT topics');
    }
  });
});

mqttClient.on('message', (topic, message) => {
  try {
    const topicParts = topic.split('/');
    const msgString = message.toString();
    
    if (topicParts[0] === 'building' && topicParts[1] === 'floor1') {
      const roomId = topicParts[2];
      const dataType = topicParts[3];
      
      if (!sensorData.has(roomId)) {
        return;
      }
      
      const sensor = sensorData.get(roomId);
      
      switch(dataType) {
        case 'smoke':
          const smokeLevel = parseFloat(msgString);
          sensor.smokeLevel = smokeLevel;
          sensor.lastUpdate = new Date().toISOString();
          
          // Check alarm condition
          if (smokeLevel > sensor.threshold) {
            if (!sensor.isAlarmActive) {
              sensor.isAlarmActive = true;
              sensor.status = 'alarm';
              triggerAlarm(roomId, smokeLevel);
            }
          } else if (smokeLevel < sensor.threshold * 0.8) {
            if (sensor.isAlarmActive) {
              sensor.isAlarmActive = false;
              sensor.status = 'normal';
              clearAlarm(roomId);
            }
          }
          
          // Update status based on smoke level
          if (smokeLevel === 0) {
            sensor.status = 'normal';
          } else if (smokeLevel < sensor.threshold * 0.5) {
            sensor.status = 'normal';
          } else if (smokeLevel < sensor.threshold) {
            sensor.status = 'warning';
          }
          
          // Broadcast update
          broadcast({
            type: 'sensor-update',
            roomId: roomId,
            data: sensor
          });
          break;
          
        case 'status':
          sensor.connectionStatus = msgString;
          break;
          
        case 'heartbeat':
          sensor.lastHeartbeat = new Date().toISOString();
          sensor.online = true;
          break;
      }
      
      sensorData.set(roomId, sensor);
    }
  } catch (err) {
    logger.error('Error processing MQTT message:', err);
  }
});

mqttClient.on('error', (err) => {
  logger.error('MQTT error:', err);
});

// Alarm Management Functions
function triggerAlarm(roomId, smokeLevel) {
  logger.warn(`ALARM TRIGGERED in ${roomId} - Smoke level: ${smokeLevel}`);
  
  broadcast({
    type: 'alarm-trigger',
    roomId: roomId,
    smokeLevel: smokeLevel,
    timestamp: new Date().toISOString()
  });
  
  // Publish alarm to MQTT
  mqttClient.publish(`building/floor1/${roomId}/alarm`, 'active');
  mqttClient.publish('building/system/alarm', JSON.stringify({
    roomId: roomId,
    smokeLevel: smokeLevel,
    timestamp: new Date().toISOString()
  }));
}

function clearAlarm(roomId) {
  logger.info(`Alarm cleared in ${roomId}`);
  
  broadcast({
    type: 'alarm-clear',
    roomId: roomId,
    timestamp: new Date().toISOString()
  });
  
  mqttClient.publish(`building/floor1/${roomId}/alarm`, 'cleared');
}

function resetAlarm(roomId) {
  const sensor = sensorData.get(roomId);
  if (sensor) {
    sensor.isAlarmActive = false;
    sensor.status = 'normal';
    sensorData.set(roomId, sensor);
    
    mqttClient.publish(`building/floor1/${roomId}/reset`, 'true');
    broadcast({
      type: 'alarm-reset',
      roomId: roomId
    });
  }
}

function silenceAlarm(roomId) {
  broadcast({
    type: 'alarm-silence',
    roomId: roomId
  });
}

function testAlarm(roomId) {
  mqttClient.publish(`building/floor1/${roomId}/test`, 'true');
  broadcast({
    type: 'alarm-test',
    roomId: roomId
  });
}

function updateThreshold(roomId, threshold) {
  const sensor = sensorData.get(roomId);
  if (sensor) {
    sensor.threshold = threshold;
    sensorData.set(roomId, sensor);
    
    mqttClient.publish(`building/floor1/${roomId}/threshold`, threshold.toString());
    
    broadcast({
      type: 'threshold-update',
      roomId: roomId,
      threshold: threshold
    });
  }
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    mqttConnected: mqttClient.connected,
    wsClients: wsClients.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/sensors', (req, res) => {
  res.json(Array.from(sensorData.values()));
});

app.get('/api/sensors/:roomId', (req, res) => {
  const sensor = sensorData.get(req.params.roomId);
  if (sensor) {
    res.json(sensor);
  } else {
    res.status(404).json({ error: 'Sensor not found' });
  }
});

app.post('/api/sensors/:roomId/config', (req, res) => {
  const { roomId } = req.params;
  const { threshold, sensitivity } = req.body;
  
  const sensor = sensorData.get(roomId);
  if (!sensor) {
    return res.status(404).json({ error: 'Sensor not found' });
  }
  
  if (threshold !== undefined) {
    updateThreshold(roomId, threshold);
  }
  
  if (sensitivity !== undefined) {
    mqttClient.publish(`building/floor1/${roomId}/config`, JSON.stringify({
      sensitivity: sensitivity
    }));
  }
  
  res.json({ success: true, roomId });
});

app.post('/api/sensors/:roomId/reset', (req, res) => {
  const { roomId } = req.params;
  resetAlarm(roomId);
  res.json({ success: true, roomId });
});

app.post('/api/sensors/:roomId/test', (req, res) => {
  const { roomId } = req.params;
  testAlarm(roomId);
  res.json({ success: true, roomId });
});

app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

app.get('/api/system/status', (req, res) => {
  const activeAlarms = Array.from(sensorData.values()).filter(s => s.isAlarmActive);
  const warnings = Array.from(sensorData.values()).filter(s => s.status === 'warning');

  res.json({
    totalRooms: rooms.length,
    activeAlarms: activeAlarms.length,
    warnings: warnings.length,
    systemStatus: activeAlarms.length > 0 ? 'alarm' : 'normal',
    timestamp: new Date().toISOString()
  });
});

// Scenario functions
const scenarios = {
  normal: (client) => {
    for (let i = 1; i <= 6; i++) {
      const smokeLevel = Math.random() * 10; // 0-10%
      client.publish(`building/floor1/room${i}/smoke`, smokeLevel.toString(), { qos: 1, retain: true });
      client.publish(`building/floor1/room${i}/status`, 'normal', { qos: 1 });
    }
  },

  singleAlarm: (client) => {
    // Normal levels for most rooms
    [1, 3, 4, 5, 6].forEach(room => {
      const smokeLevel = Math.random() * 10;
      client.publish(`building/floor1/room${room}/smoke`, smokeLevel.toString(), { qos: 1, retain: true });
    });
    // High level in kitchen
    client.publish('building/floor1/room2/smoke', '75', { qos: 1, retain: true });
    client.publish('building/floor1/room2/status', 'alarm', { qos: 1 });
  },

  multipleAlarms: (client) => {
    const alarmRooms = [2, 3, 5];
    for (let i = 1; i <= 6; i++) {
      const smokeLevel = alarmRooms.includes(i) ? 60 + Math.random() * 30 : Math.random() * 10;
      client.publish(`building/floor1/room${i}/smoke`, smokeLevel.toString(), { qos: 1, retain: true });
      client.publish(`building/floor1/room${i}/status`, smokeLevel > 50 ? 'alarm' : 'normal', { qos: 1 });
    }
  },

  gradualIncrease: (client) => {
    let level = 0;
    const interval = setInterval(() => {
      level += 5;
      client.publish('building/floor1/room1/smoke', level.toString(), { qos: 1, retain: true });
      logger.info(`Room 1 smoke level: ${level}%`);

      if (level >= 80) {
        clearInterval(interval);
        logger.info('Peak reached, maintaining high level');
      }
    }, 1000);
  },

  intermittent: (client) => {
    const interval = setInterval(() => {
      const room = Math.floor(Math.random() * 6) + 1;
      const spike = Math.random() < 0.3;
      const level = spike ? 30 + Math.random() * 25 : Math.random() * 10;

      client.publish(`building/floor1/room${room}/smoke`, level.toString(), { qos: 1, retain: true });
      if (spike) {
        logger.info(`Spike in Room ${room}: ${level.toFixed(1)}%`);
      }
    }, 2000);

    // Stop after 60 seconds
    setTimeout(() => clearInterval(interval), 60000);
  },

  systemTest: async (client) => {
    const states = ['normal', 'warning', 'alarm'];
    const levels = [5, 35, 65];

    for (let state = 0; state < states.length; state++) {
      logger.info(`Setting all sensors to: ${states[state]}`);
      for (let room = 1; room <= 6; room++) {
        client.publish(`building/floor1/room${room}/smoke`, levels[state].toString(), { qos: 1, retain: true });
        client.publish(`building/floor1/room${room}/status`, states[state], { qos: 1 });
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Scenario trigger endpoint
app.post('/api/scenarios/:scenarioId', (req, res) => {
  const { scenarioId } = req.params;

  if (!scenarios[scenarioId]) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  logger.info(`Triggering scenario: ${scenarioId}`);

  try {
    scenarios[scenarioId](mqttClient);
    res.json({ success: true, scenarioId });
  } catch (error) {
    logger.error(`Error executing scenario ${scenarioId}:`, error);
    res.status(500).json({ error: 'Failed to execute scenario' });
  }
});

// Start Express server
app.listen(API_PORT, () => {
  logger.info(`API server running on port ${API_PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  mqttClient.end();
  wss.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  mqttClient.end();
  wss.close();
  process.exit(0);
});

logger.info('Smart Building Backend Started');
logger.info(`API Port: ${API_PORT}, WebSocket Port: ${WS_PORT}`);
