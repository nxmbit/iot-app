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
    isManuallySet: false, // Flag to prevent automatic updates when user manually sets value
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
    case 'trigger-room-alarm':
      triggerRoomAlarm(data.roomId);
      break;
    case 'trigger-global-alarm':
      triggerGlobalAlarm();
      break;
    case 'reset-room-status':
      resetRoomStatus(data.roomId);
      break;
    case 'reset-global-status':
      resetGlobalStatus();
      break;
    case 'set-manual-smoke-level':
      if (data.smokeLevel !== undefined) {
        setManualSmokeLevel(data.roomId, data.smokeLevel);
      }
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
          // Skip automatic updates if user has manually set the smoke level
          if (sensor.isManuallySet) {
            logger.debug(`Skipping automatic smoke update for ${roomId} - manually set`);
            break;
          }

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

// New Control Scenario Functions

/**
 * Trigger alarm for a specific room
 * Sets alarm state and high smoke level for the specified room
 */
function triggerRoomAlarm(roomId) {
  const sensor = sensorData.get(roomId);
  if (sensor) {
    sensor.isAlarmActive = true;
    sensor.status = 'alarm';
    sensor.smokeLevel = sensor.threshold + 20; // Set above threshold
    sensor.isManuallySet = true; // Prevent automatic updates
    sensor.lastUpdate = new Date().toISOString();
    sensorData.set(roomId, sensor);

    logger.info(`Manual alarm triggered for ${roomId}`);

    // Publish to MQTT
    mqttClient.publish(`building/floor1/${roomId}/smoke`, sensor.smokeLevel.toString());
    mqttClient.publish(`building/floor1/${roomId}/alarm`, 'active');

    // Broadcast to WebSocket clients
    broadcast({
      type: 'alarm-trigger',
      roomId: roomId,
      smokeLevel: sensor.smokeLevel,
      timestamp: new Date().toISOString(),
      manual: true
    });

    broadcast({
      type: 'sensor-update',
      roomId: roomId,
      data: sensor
    });
  }
}

/**
 * Trigger alarm for all rooms in the system
 */
function triggerGlobalAlarm() {
  logger.info('Global alarm triggered for all rooms');

  rooms.forEach(room => {
    triggerRoomAlarm(room.id);
  });

  broadcast({
    type: 'global-alarm-trigger',
    timestamp: new Date().toISOString()
  });
}

/**
 * Reset specific room - clear alarm and set smoke level to 0
 * Also clears the manual override flag to allow automatic updates
 */
function resetRoomStatus(roomId) {
  const sensor = sensorData.get(roomId);
  if (sensor) {
    sensor.isAlarmActive = false;
    sensor.status = 'normal';
    sensor.smokeLevel = 0; // Reset to safe level
    sensor.isManuallySet = false; // Clear manual override - allow automatic updates
    sensor.lastUpdate = new Date().toISOString();
    sensorData.set(roomId, sensor);

    logger.info(`Room ${roomId} status reset`);

    // Publish to MQTT
    mqttClient.publish(`building/floor1/${roomId}/smoke`, '0');
    mqttClient.publish(`building/floor1/${roomId}/reset`, 'true');
    mqttClient.publish(`building/floor1/${roomId}/alarm`, 'cleared');

    // Broadcast to WebSocket clients
    broadcast({
      type: 'room-reset',
      roomId: roomId,
      timestamp: new Date().toISOString()
    });

    broadcast({
      type: 'sensor-update',
      roomId: roomId,
      data: sensor
    });
  }
}

/**
 * Reset all rooms - clear all alarms and set all smoke levels to 0
 */
function resetGlobalStatus() {
  logger.info('Global reset - resetting all rooms');

  rooms.forEach(room => {
    resetRoomStatus(room.id);
  });

  broadcast({
    type: 'global-reset',
    timestamp: new Date().toISOString()
  });
}

/**
 * Manually set smoke level for a specific room
 * This will persist and prevent automatic updates until reset
 */
function setManualSmokeLevel(roomId, smokeLevel) {
  const sensor = sensorData.get(roomId);
  if (sensor) {
    sensor.smokeLevel = smokeLevel;
    sensor.isManuallySet = true; // Mark as manually set
    sensor.lastUpdate = new Date().toISOString();

    // Update status and alarm based on new smoke level
    if (smokeLevel > sensor.threshold) {
      sensor.isAlarmActive = true;
      sensor.status = 'alarm';
    } else if (smokeLevel > sensor.threshold * 0.7) {
      sensor.status = 'warning';
    } else {
      sensor.isAlarmActive = false;
      sensor.status = 'normal';
    }

    sensorData.set(roomId, sensor);

    logger.info(`Manual smoke level set for ${roomId}: ${smokeLevel}`);

    // Publish to MQTT
    mqttClient.publish(`building/floor1/${roomId}/smoke`, smokeLevel.toString());

    // Broadcast to WebSocket clients
    broadcast({
      type: 'sensor-update',
      roomId: roomId,
      data: sensor
    });

    // Trigger alarm if needed
    if (sensor.isAlarmActive) {
      broadcast({
        type: 'alarm-trigger',
        roomId: roomId,
        smokeLevel: smokeLevel,
        timestamp: new Date().toISOString(),
        manual: true
      });
    }
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

// New Control Scenario API Endpoints

app.post('/api/sensors/:roomId/trigger-alarm', (req, res) => {
  const { roomId } = req.params;
  const sensor = sensorData.get(roomId);
  if (!sensor) {
    return res.status(404).json({ error: 'Sensor not found' });
  }
  triggerRoomAlarm(roomId);
  res.json({ success: true, roomId, message: 'Alarm triggered for room' });
});

app.post('/api/system/trigger-global-alarm', (req, res) => {
  triggerGlobalAlarm();
  res.json({ success: true, message: 'Global alarm triggered for all rooms' });
});

app.post('/api/sensors/:roomId/reset-status', (req, res) => {
  const { roomId } = req.params;
  const sensor = sensorData.get(roomId);
  if (!sensor) {
    return res.status(404).json({ error: 'Sensor not found' });
  }
  resetRoomStatus(roomId);
  res.json({ success: true, roomId, message: 'Room status reset' });
});

app.post('/api/system/reset-global-status', (req, res) => {
  resetGlobalStatus();
  res.json({ success: true, message: 'All rooms reset' });
});

app.post('/api/sensors/:roomId/set-smoke-level', (req, res) => {
  const { roomId } = req.params;
  const { smokeLevel } = req.body;

  const sensor = sensorData.get(roomId);
  if (!sensor) {
    return res.status(404).json({ error: 'Sensor not found' });
  }

  if (smokeLevel === undefined || smokeLevel < 0 || smokeLevel > 100) {
    return res.status(400).json({ error: 'Invalid smoke level (must be 0-100)' });
  }

  setManualSmokeLevel(roomId, smokeLevel);
  res.json({ success: true, roomId, smokeLevel, message: 'Smoke level manually set' });
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
