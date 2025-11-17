# Smart Building IoT Alarm System - Technical Analysis

**Analysis Date:** 2025-11-17
**Branch:** master (via merged PR #2)
**Total Lines of Code:** ~2,200

---

## Executive Summary

This is a sophisticated, production-ready IoT smoke detection and alarm system designed for smart buildings. The application demonstrates excellent architectural design with clear separation of concerns across four microservices: a React frontend dashboard, Node.js/Express backend API, MQTT-based sensor simulator, and Eclipse Mosquitto message broker.

**Key Strengths:**
- Well-architected microservices using Docker Compose
- Real-time bidirectional communication (WebSocket + MQTT)
- Comprehensive test scenario system
- Professional logging and monitoring
- Clean, maintainable code structure
- Excellent Polish documentation with Mermaid diagrams

**Primary Use Cases:**
- Smart building smoke detection and alerting
- IoT sensor monitoring and management
- Fire safety system simulation and training
- Testing alarm response protocols

---

## Architecture Overview

### System Components

```
┌─────────────────┐
│  Frontend       │ ← React 18 + WebSocket Client
│  Port: 3000     │
└────────┬────────┘
         │
         ├─── HTTP ──────► ┌──────────────────┐
         │                 │  Backend API     │
         └── WebSocket ──► │  Ports: 3001,    │
                           │        8080      │
                           └────────┬─────────┘
                                    │
                                    │ MQTT
                                    ▼
                           ┌──────────────────┐
                           │  Mosquitto       │
                           │  Port: 1883      │
                           └────────┬─────────┘
                                    │
                                    │ MQTT
                                    ▼
                           ┌──────────────────┐
                           │  Sensor          │
                           │  Simulator       │
                           └──────────────────┘
```

### Communication Protocols

1. **Frontend ↔ Backend**
   - HTTP REST API (port 3001) - Initial data, configuration
   - WebSocket (port 8080) - Real-time sensor updates, alarms

2. **Backend ↔ Sensors**
   - MQTT (port 1883) - Pub/Sub pattern
   - QoS Level 1 (at least once delivery)
   - Retained messages for state persistence

3. **MQTT Topic Structure**
   ```
   building/floor1/room[1-6]/smoke      ← Sensor → Backend
   building/floor1/room[1-6]/status     ← Sensor → Backend
   building/floor1/room[1-6]/heartbeat  ← Sensor → Backend
   building/floor1/room[1-6]/alarm      ← Backend → Sensor
   building/floor1/room[1-6]/reset      ← Backend → Sensor
   building/floor1/room[1-6]/threshold  ← Backend → Sensor
   building/floor1/room[1-6]/config     ← Backend → Sensor
   building/system/alarm                ← Backend (system-wide)
   ```

---

## Component Deep Dive

### 1. Frontend (`frontend/`)

**Technology Stack:**
- React 18.2.0 with Hooks
- Recharts 2.9.3 for data visualization
- Axios 1.6.2 for HTTP requests
- Web Audio API for alarm sounds
- Lucide React for icons

**Main Components:**

#### App.js (375 lines)
- **State Management:** Uses React hooks for sensors, alarms, WebSocket connection
- **WebSocket Integration:** Auto-reconnect logic with 3-second timeout
- **Alarm Audio:** Web Audio API generates 800Hz square wave alarm with 0.5s beep pattern
- **Browser Notifications:** Requests permission and displays system notifications
- **History Tracking:** Maintains 60-reading circular buffer per sensor

**Key Features:**
```javascript
// Alarm sound generation using Web Audio API
oscillator.type = 'square';
oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
// Beeping pattern by modulating gain
for (let i = 0; i < 100; i++) {
  gainNode.gain.setValueAtTime(0.3, time);
  gainNode.gain.setValueAtTime(0, time + beepInterval / 2);
  time += beepInterval;
}
```

#### FloorPlan Component
- SVG-based interactive floor plan
- 6 rooms with custom dimensions and positions
- Color-coded status visualization (green/yellow/red)
- Smoke opacity overlay for visual feedback
- Room selection interaction

#### ScenarioSelector Component (NEW in v2.0)
- 6 predefined test scenarios
- Polish UI with loading states
- Triggers backend scenario API endpoints
- Auto-resets after 2 seconds

#### SensorPanel Component
- Detailed sensor information display
- Threshold configuration slider
- Reset and test alarm buttons
- Real-time status updates

#### HistoryChart Component
- Line chart using Recharts
- Displays last 60 readings
- Threshold reference line
- Responsive design

**State Flow:**
1. Initial load → HTTP GET `/api/sensors`
2. WebSocket connect → Receive `initial-state`
3. Real-time updates → WebSocket `sensor-update` events
4. Alarm triggers → WebSocket `alarm-trigger` → Play sound + Notification
5. User actions → WebSocket commands → Backend

### 2. Backend (`backend/server.js`)

**Technology Stack:**
- Express 4.18.2
- MQTT.js 5.3.0
- WebSocket (ws) 8.14.2
- Winston 3.11.0 for logging
- CORS + body-parser middleware

**Architecture:** (520 lines)

#### Data Storage
```javascript
const sensorData = new Map();  // In-memory sensor state
const alarmStates = new Map(); // Alarm tracking
const rooms = [...];           // Room configuration
```

#### MQTT Client Configuration
```javascript
const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
  clientId: `backend_${Math.random().toString(16).slice(3)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});
```

#### WebSocket Server
- Manages Set of connected clients
- Broadcasts to all clients simultaneously
- Handles bidirectional commands
- Sends initial state on connection

#### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/sensors` | GET | All sensor data |
| `/api/sensors/:roomId` | GET | Specific sensor |
| `/api/sensors/:roomId/config` | POST | Update threshold/sensitivity |
| `/api/sensors/:roomId/reset` | POST | Reset alarm |
| `/api/sensors/:roomId/test` | POST | Test alarm |
| `/api/rooms` | GET | Room configuration |
| `/api/system/status` | GET | System-wide status |
| `/api/scenarios/:scenarioId` | POST | Trigger test scenario |

#### Alarm Logic
```javascript
// Trigger condition
if (smokeLevel > sensor.threshold) {
  if (!sensor.isAlarmActive) {
    sensor.isAlarmActive = true;
    sensor.status = 'alarm';
    triggerAlarm(roomId, smokeLevel);
  }
}

// Clear condition (with hysteresis)
if (smokeLevel < sensor.threshold * 0.8) {
  if (sensor.isAlarmActive) {
    clearAlarm(roomId);
  }
}
```

**Hysteresis:** 80% threshold prevents alarm flapping

#### Test Scenarios (NEW in v2.0)

Six predefined scenarios with automatic sensor reset:

1. **normal** - All sensors 0-10%
2. **singleAlarm** - Kitchen at 75%
3. **multipleAlarms** - Rooms 2,3,5 at 60-90%
4. **gradualIncrease** - Room 1: 0→80% (+5%/sec)
5. **intermittent** - Random spikes for 60 seconds
6. **systemTest** - Sequential state testing (normal→warning→alarm)

**Critical Feature:** `resetAllSensors()` called before each scenario to prevent state pollution:
```javascript
const resetAllSensors = (client) => {
  for (let i = 1; i <= 6; i++) {
    client.publish(`building/floor1/room${i}/reset`, '', { qos: 1 });
  }
  setTimeout(() => { /* Execute scenario */ }, 500);
};
```

### 3. Sensor Simulator (`sensors/simulator.js`)

**Technology Stack:**
- MQTT.js 5.3.0
- Winston logging
- Dotenv configuration

**SmokeSensor Class:** (176 lines)

Properties:
- `smokeLevel` - Current smoke percentage (0-100)
- `threshold` - Alarm trigger point (default: 50)
- `fireSimulation` - Active fire state object
- `simulationMode` - realistic | random | test

**Simulation Modes:**

#### 1. Realistic Mode
```javascript
realisticSimulation() {
  // Baseline noise (cooking, dust)
  this.baselineNoise = Math.sin(Date.now() / 10000) * 2 + Math.random() * this.noiseLevel;

  // Random fire events (0.1% probability)
  if (!this.fireSimulation && Math.random() < this.fireStartProbability) {
    this.startFire();
  }

  if (this.fireSimulation) {
    // Smoke grows towards fire intensity
    const targetLevel = fireIntensity * 100;
    this.smokeLevel += growth + randomness;

    // Fire might spread
    if (Math.random() < 0.05) {
      this.fireSimulation.intensity += 0.1;
    }

    // Fire eventually dies
    if (duration > maxDuration || Math.random() < 0.01) {
      this.endFire();
    }
  }
}
```

**Fire Simulation Parameters:**
- Fire start probability: 0.1% per update
- Intensity: 0.3-0.7 (randomized)
- Types: electrical, combustion
- Max duration: 60 seconds
- Spread probability: 5% per update

#### 2. Random Mode
- Simple random walk (-5 to +5 per update)
- Occasional spikes (2% chance, +0-30%)
- 95% decay rate

#### 3. Test Mode
- 120-second predictable cycle
- Four phases: low (10±5), medium (30±10), high (60±20), cooling (20±10)

**Publishing Rate:** 1000ms (1 Hz)
**Heartbeat Rate:** 5000ms (0.2 Hz)

### 4. MQTT Broker (Mosquitto)

**Configuration:**
```conf
listener 1883                    # Standard MQTT port
listener 9001 protocol websockets # WebSocket MQTT (unused)
allow_anonymous true              # ⚠️ No authentication (dev mode)
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log
max_keepalive 60
```

**⚠️ Security Warning:** Anonymous access is enabled - NOT production-ready

---

## Data Flow Analysis

### Sensor Update Flow (Happy Path)

```
1. Sensor Simulator (every 1s)
   sensor.updateSmokeLevel()
   └─► smokeLevel = 47.3

2. MQTT Publish
   Topic: building/floor1/room2/smoke
   Payload: "47.3"
   QoS: 1 (at least once)
   Retained: true

3. Backend MQTT Handler
   Receives message
   └─► Parses roomId from topic
   └─► Updates sensorData Map
   └─► Checks alarm condition (47.3 < 50 ✓)
   └─► Updates status: 'warning' (> 25)

4. Backend WebSocket Broadcast
   {
     type: 'sensor-update',
     roomId: 'room2',
     data: { smokeLevel: 47.3, status: 'warning', ... }
   }

5. Frontend WebSocket Handler
   Updates sensors state
   └─► Triggers re-render
   └─► Updates history buffer
   └─► FloorPlan shows yellow room
```

### Alarm Trigger Flow

```
1. Sensor: smokeLevel = 55 (> threshold 50)

2. Backend MQTT Handler
   if (55 > 50 && !isAlarmActive) {
     sensor.isAlarmActive = true
     triggerAlarm(roomId, 55)
   }

3. triggerAlarm() Function
   a) Log warning
   b) WebSocket broadcast: { type: 'alarm-trigger', roomId, smokeLevel }
   c) MQTT publish: building/floor1/room2/alarm → 'active'
   d) MQTT publish: building/system/alarm → JSON metadata

4. Frontend Handles alarm-trigger
   setAlarmActive(true)
   setAlarmSound(true)
   playAlarmSound()    ← Web Audio API
   showNotification()  ← Browser API

5. User Experience
   - Red flashing room on floor plan
   - 800Hz beeping sound (0.5s interval)
   - Browser notification
   - "AKTYWNY ALARM" indicator
   - Alarm control panel shows silence button
```

### Scenario Execution Flow

```
1. User clicks "Multiple Room Alarms" in ScenarioSelector

2. Frontend → Backend
   POST /api/scenarios/multipleAlarms

3. Backend scenarios.multipleAlarms()
   a) resetAllSensors(mqttClient)
      └─► Publishes 'reset' to all 6 rooms

   b) Wait 500ms for reset to propagate

   c) Publish new smoke levels:
      - Rooms 2,3,5: 60-90% (alarms)
      - Rooms 1,4,6: 0-10% (normal)

   d) Return { success: true }

4. Sensors Receive Reset Command
   sensor.reset()
   └─► smokeLevel = 0
   └─► fireSimulation = null

5. Sensors Receive New Smoke Values
   (MQTT retained messages)
   └─► Override current smokeLevel
   └─► On next update cycle, sensors continue from new baseline

6. Backend Processes High Levels
   └─► Triggers alarms for rooms 2,3,5

7. Frontend Shows Multiple Alarms
   └─► Three red rooms on floor plan
   └─► Alarm sound playing
   └─► Status bar: "activeAlarms: 3"
```

---

## Code Quality Assessment

### Strengths

1. **Clean Architecture**
   - Clear separation of concerns
   - Single Responsibility Principle
   - DRY (Don't Repeat Yourself) patterns

2. **Error Handling**
   ```javascript
   // Backend MQTT handler
   mqttClient.on('message', (topic, message) => {
     try {
       // ... processing
     } catch (err) {
       logger.error('Error processing MQTT message:', err);
     }
   });

   // Frontend WebSocket
   ws.current.onerror = (error) => {
     console.error('WebSocket error:', error);
     setWsConnected(false);
   };
   ```

3. **Graceful Shutdown**
   ```javascript
   process.on('SIGTERM', () => {
     logger.info('Shutting down gracefully');
     mqttClient.end();
     wss.close();
     process.exit(0);
   });
   ```

4. **Logging**
   - Winston logger with JSON format
   - Different log levels (info, warn, error, debug)
   - Timestamps included

5. **Reconnection Logic**
   - MQTT: 1-second reconnect period
   - WebSocket: 3-second reconnect timeout
   - Prevents connection storms

6. **Documentation**
   - Comprehensive README with Mermaid diagrams
   - Polish language (fits target market)
   - Code comments where necessary
   - DEPLOYMENT.md for production guidance

### Areas for Improvement

#### 1. Security Vulnerabilities ⚠️

**Current State:**
```javascript
// mosquitto.conf
allow_anonymous true  // ❌ No authentication

// server.js
app.use(cors());      // ❌ Allows all origins

// No input validation
const threshold = parseFloat(message);  // ❌ No bounds check
```

**Recommendations:**
```javascript
// Add authentication
const basicAuth = require('express-basic-auth');
app.use(basicAuth({
  users: { 'admin': process.env.ADMIN_PASSWORD },
  challenge: true
}));

// Restrict CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true
}));

// Validate input
const Joi = require('joi');
const thresholdSchema = Joi.number().min(0).max(100).required();
```

**MQTT Authentication:**
```conf
# mosquitto.conf
allow_anonymous false
password_file /mosquitto/config/passwd
acl_file /mosquitto/config/acl
```

#### 2. Missing Input Validation

```javascript
// Current - No validation
app.post('/api/sensors/:roomId/config', (req, res) => {
  const { threshold } = req.body;
  updateThreshold(roomId, threshold);  // ❌ Could be negative, NaN, etc.
});

// Recommended
const { body, param } = require('express-validator');
app.post('/api/sensors/:roomId/config',
  param('roomId').matches(/^room[1-6]$/),
  body('threshold').isFloat({ min: 0, max: 100 }),
  body('sensitivity').optional().isFloat({ min: 0, max: 2 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ... proceed
  }
);
```

#### 3. No Rate Limiting

```javascript
// Add rate limiting
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', apiLimiter);

const scenarioLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // max 5 scenario changes per minute
});

app.use('/api/scenarios/', scenarioLimiter);
```

#### 4. No Persistent Storage

**Current:**
- All data in memory (Map objects)
- Data lost on restart
- No historical analysis possible

**Recommendations:**
```javascript
// Option 1: SQLite for simplicity
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./sensor_history.db');

// Option 2: PostgreSQL for production
const { Pool } = require('pg');
const pool = new Pool({ /* config */ });

// Schema
CREATE TABLE sensor_readings (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(10),
  smoke_level DECIMAL(5,2),
  status VARCHAR(20),
  is_alarm_active BOOLEAN,
  timestamp TIMESTAMP DEFAULT NOW()
);

// Store readings
function storeSensorReading(sensor) {
  db.run(`INSERT INTO sensor_readings
          (room_id, smoke_level, status, is_alarm_active)
          VALUES (?, ?, ?, ?)`,
    [sensor.roomId, sensor.smokeLevel, sensor.status, sensor.isAlarmActive]
  );
}
```

#### 5. No Unit Tests

**Current:** Test scripts mentioned but not implemented

**Recommendations:**
```javascript
// backend/__tests__/server.test.js
const request = require('supertest');
const app = require('../server');

describe('API Endpoints', () => {
  test('GET /api/health returns healthy status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  test('GET /api/sensors returns array', async () => {
    const response = await request(app).get('/api/sensors');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(6);
  });

  test('POST /api/sensors/room1/config validates threshold', async () => {
    const response = await request(app)
      .post('/api/sensors/room1/config')
      .send({ threshold: 150 }); // Invalid
    expect(response.statusCode).toBe(400);
  });
});

// frontend/src/components/__tests__/FloorPlan.test.js
import { render, fireEvent } from '@testing-library/react';
import FloorPlan from '../FloorPlan';

test('room selection works', () => {
  const mockSelect = jest.fn();
  const { getByTestId } = render(
    <FloorPlan sensors={mockSensors} onRoomSelect={mockSelect} />
  );
  fireEvent.click(getByTestId('room1'));
  expect(mockSelect).toHaveBeenCalledWith('room1');
});
```

#### 6. No SSL/TLS

**Current:**
- HTTP only (port 3001)
- WS only (port 8080)
- MQTT unencrypted (port 1883)

**Recommendations:**
```javascript
// HTTPS server
const https = require('https');
const fs = require('fs');

const httpsOptions = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem')
};

https.createServer(httpsOptions, app).listen(443);

// WSS (WebSocket Secure)
const wss = new WebSocket.Server({ server: httpsServer });

// MQTT TLS
const mqttClient = mqtt.connect('mqtts://localhost:8883', {
  ca: fs.readFileSync('/path/to/ca.crt'),
  cert: fs.readFileSync('/path/to/client.crt'),
  key: fs.readFileSync('/path/to/client.key')
});
```

#### 7. Hard-coded Configuration

**Current:**
```javascript
const API_PORT = process.env.API_PORT || 3001;  // ✓ Good
const rooms = [ /* hard-coded */ ];              // ❌ Should be configurable
```

**Recommended:**
```javascript
// config/rooms.json
{
  "rooms": [
    { "id": "room1", "name": "Living Room", ... },
    ...
  ]
}

// Load dynamically
const roomConfig = require('./config/rooms.json');
```

#### 8. No Monitoring/Metrics

**Recommendations:**
```javascript
// Add Prometheus metrics
const promClient = require('prom-client');

const sensorGauge = new promClient.Gauge({
  name: 'smoke_sensor_level',
  help: 'Current smoke level percentage',
  labelNames: ['room_id']
});

const alarmCounter = new promClient.Counter({
  name: 'alarm_triggers_total',
  help: 'Total number of alarms triggered',
  labelNames: ['room_id']
});

// Update metrics
sensorGauge.set({ room_id: roomId }, smokeLevel);
alarmCounter.inc({ room_id: roomId });

// Expose endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

---

## Performance Analysis

### Current Performance Characteristics

**Message Throughput:**
- Sensors: 6 rooms × 1 Hz = 6 messages/second
- Backend processing: < 1ms per message (in-memory Map)
- WebSocket broadcast: O(n) where n = connected clients
- Expected latency: < 50ms end-to-end

**Resource Usage (estimated):**
```
Frontend:  ~50 MB RAM (React + history buffers)
Backend:   ~30 MB RAM (Node.js + in-memory data)
Sensors:   ~25 MB RAM (Node.js + MQTT client)
Mosquitto: ~5 MB RAM (6 topics, retained messages)
Total:     ~110 MB RAM
```

**Scalability Bottlenecks:**

1. **In-memory storage** - Limited to single server
2. **WebSocket broadcast** - O(n) complexity
3. **No horizontal scaling** - Stateful backend

### Optimization Recommendations

#### 1. Add Redis for State Management

```javascript
const redis = require('redis');
const client = redis.createClient();

// Store sensor data
async function updateSensor(roomId, data) {
  await client.hSet(`sensor:${roomId}`, data);
  await client.expire(`sensor:${roomId}`, 3600); // 1 hour TTL
}

// Retrieve sensor data
async function getSensor(roomId) {
  return await client.hGetAll(`sensor:${roomId}`);
}

// Pub/Sub for multi-server
const subscriber = client.duplicate();
await subscriber.subscribe('sensor-updates', (message) => {
  const update = JSON.parse(message);
  broadcast(update);
});
```

#### 2. Implement WebSocket Rooms

```javascript
// Group clients by interest
const wss = new WebSocket.Server({ port: WS_PORT });
const rooms = new Map(); // roomId → Set<WebSocket>

ws.on('message', (msg) => {
  const { type, roomId } = JSON.parse(msg);
  if (type === 'subscribe') {
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(ws);
  }
});

// Broadcast only to interested clients
function broadcastToRoom(roomId, data) {
  const subscribers = rooms.get(roomId) || new Set();
  subscribers.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
```

#### 3. Add Caching

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 10 }); // 10 second TTL

app.get('/api/sensors', (req, res) => {
  const cached = cache.get('all-sensors');
  if (cached) {
    return res.json(cached);
  }

  const sensors = Array.from(sensorData.values());
  cache.set('all-sensors', sensors);
  res.json(sensors);
});
```

#### 4. Database Indexing

```sql
-- If using PostgreSQL
CREATE INDEX idx_sensor_readings_room_time
ON sensor_readings(room_id, timestamp DESC);

CREATE INDEX idx_sensor_readings_alarm
ON sensor_readings(is_alarm_active)
WHERE is_alarm_active = true;
```

---

## Docker Configuration Analysis

### Current Setup

**docker-compose.yml:**
- 4 services: mosquitto, backend, sensors, frontend
- Single bridge network: `iot-network`
- Volume mounts for development (hot reload)
- No resource limits

**Dockerfile Analysis:**

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

**Issues:**
1. Not multi-stage build (large image size)
2. No production build
3. Development dependencies included
4. Running as root user

**Recommendations:**

```dockerfile
# Multi-stage build for frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
USER nginx
CMD ["nginx", "-g", "daemon off;"]
```

```yaml
# Production docker-compose.yml
version: '3.8'
services:
  backend:
    image: iot-backend:1.0
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## Recent Changes (v2.0.0)

Based on git history analysis:

### PR #2 Merged Changes

**Commits:**
1. `57d2170` - Fix scenario persistence issue by resetting sensors first
2. `8252387` - Translate frontend UI to Polish
3. `87d3393` - Add comprehensive Polish README with Mermaid diagrams
4. `34e8626` - Add scenario selector and fix alarm sound

**Impact Analysis:**

#### 1. Scenario Reset Fix (Critical Bug Fix)
**Problem:** Scenarios didn't properly reset sensor state, causing unpredictable behavior
**Solution:** Added `resetAllSensors()` function called before each scenario
**Files:** `backend/server.js:378-383`

**Before:**
```javascript
// Scenario would publish new values but sensors kept old state
scenarios.singleAlarm = (client) => {
  client.publish('building/floor1/room2/smoke', '75');
  // Other rooms retained their previous high values!
};
```

**After:**
```javascript
scenarios.singleAlarm = (client) => {
  resetAllSensors(client); // ← NEW
  setTimeout(() => {
    client.publish('building/floor1/room2/smoke', '75');
    // Now guaranteed clean state
  }, 500);
};
```

#### 2. Alarm Sound Fix (User Experience)
**Problem:** Alarm sound not working reliably
**Solution:** Switched to Web Audio API with programmatic beep generation
**Files:** `frontend/src/App.js:139-195`

**Technical Details:**
- Uses `AudioContext` instead of `<audio>` element
- Generates square wave oscillator at 800Hz
- Gain modulation creates 0.5s beep pattern
- More reliable across browsers
- No audio file dependencies

#### 3. Polish Translation
**Impact:** Full UI localization
**Files:** Multiple component files

**Examples:**
- "Smart Building Alarm System" → "System Alarmowy Inteligentnego Budynku"
- "Floor Plan" → "Plan Piętra Budynku"
- "Test Scenarios" → "Scenariusze Testowe"

#### 4. Documentation Enhancement
**Added:** Mermaid diagrams for architecture, data flow, state machines
**Impact:** Significantly improved onboarding and system understanding

---

## Deployment Considerations

### Current State: Development-Ready
The application is configured for local development with Docker Compose.

### Production Readiness Checklist

#### ✅ Ready
- [x] Microservices architecture
- [x] Docker containerization
- [x] Graceful shutdown handling
- [x] Logging infrastructure
- [x] Error handling
- [x] Documentation

#### ❌ Not Ready
- [ ] Authentication/Authorization
- [ ] HTTPS/WSS/MQTTS
- [ ] Input validation
- [ ] Rate limiting
- [ ] Persistent storage
- [ ] Monitoring/Alerting
- [ ] Horizontal scaling
- [ ] Backup strategy
- [ ] Disaster recovery
- [ ] Load balancing
- [ ] CI/CD pipeline
- [ ] Security scanning

### Recommended Production Architecture

```
Internet
    ↓
[Cloudflare/CDN]
    ↓
[Load Balancer (Nginx)]
    ↓
┌──────────────────────────────┐
│  Kubernetes Cluster          │
│                              │
│  ┌────────────────┐          │
│  │ Frontend Pods  │ ×3       │
│  │ (Nginx+React)  │          │
│  └────────────────┘          │
│          ↓                   │
│  ┌────────────────┐          │
│  │ Backend Pods   │ ×3       │
│  │ (Node.js API)  │          │
│  └────────────────┘          │
│          ↓                   │
│  ┌────────────────┐          │
│  │ Sensor Pods    │ ×2       │
│  └────────────────┘          │
│          ↓                   │
│  ┌────────────────┐          │
│  │ MQTT Cluster   │ ×3       │
│  │ (EMQX/VerneMQ) │          │
│  └────────────────┘          │
└──────────────────────────────┘
         ↓
[PostgreSQL (RDS)]
[Redis (ElastiCache)]
[S3 (Logs/Backups)]
```

### Environment Variables for Production

```bash
# Backend
NODE_ENV=production
API_PORT=3001
WS_PORT=8080
MQTT_BROKER_URL=mqtts://mqtt-cluster:8883
DB_HOST=postgres.internal
DB_PORT=5432
DB_NAME=iot_sensors
DB_USER=iot_user
DB_PASSWORD=${SECRET_DB_PASSWORD}
REDIS_URL=redis://redis-cluster:6379
JWT_SECRET=${SECRET_JWT_KEY}
ALLOWED_ORIGINS=https://iot.example.com
LOG_LEVEL=warn
SENTRY_DSN=${SENTRY_DSN}

# Frontend
REACT_APP_API_URL=https://api.iot.example.com
REACT_APP_WS_URL=wss://api.iot.example.com/ws
REACT_APP_ENABLE_NOTIFICATIONS=true

# Sensors
MQTT_BROKER_URL=mqtts://mqtt-cluster:8883
MQTT_USERNAME=sensor_client
MQTT_PASSWORD=${SECRET_MQTT_PASSWORD}
MQTT_CERT=/certs/client.crt
MQTT_KEY=/certs/client.key
SIMULATION_MODE=realistic
NUM_ROOMS=6
```

---

## Testing Strategy Recommendations

### 1. Unit Tests

```javascript
// Backend
describe('Alarm Logic', () => {
  test('triggers alarm when smoke exceeds threshold', () => {
    const sensor = createMockSensor({ smokeLevel: 60, threshold: 50 });
    const result = checkAlarmCondition(sensor);
    expect(result.shouldTrigger).toBe(true);
  });

  test('uses hysteresis for alarm clearing', () => {
    const sensor = createMockSensor({
      smokeLevel: 45,
      threshold: 50,
      isAlarmActive: true
    });
    const result = checkAlarmCondition(sensor);
    // 45 > 40 (80% of 50), so alarm stays active
    expect(result.shouldClear).toBe(false);
  });
});

// Frontend
describe('WebSocket Handler', () => {
  test('updates sensor state on sensor-update message', () => {
    const { result } = renderHook(() => useSensorState());
    act(() => {
      result.current.handleMessage({
        type: 'sensor-update',
        roomId: 'room1',
        data: { smokeLevel: 30 }
      });
    });
    expect(result.current.sensors[0].smokeLevel).toBe(30);
  });
});
```

### 2. Integration Tests

```javascript
describe('Sensor to Frontend Flow', () => {
  let mqttClient, backendServer, wsClient;

  beforeAll(async () => {
    backendServer = await startTestServer();
    mqttClient = mqtt.connect(TEST_BROKER);
    wsClient = new WebSocket(TEST_WS_URL);
    await waitForConnection(wsClient);
  });

  test('MQTT message propagates to WebSocket', (done) => {
    wsClient.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.type === 'sensor-update' && data.roomId === 'room1') {
        expect(data.data.smokeLevel).toBe(55);
        done();
      }
    });

    mqttClient.publish('building/floor1/room1/smoke', '55');
  });
});
```

### 3. End-to-End Tests

```javascript
// Cypress E2E test
describe('Alarm System E2E', () => {
  it('triggers alarm on high smoke level', () => {
    cy.visit('/');
    cy.get('[data-testid="room1"]').should('have.class', 'normal');

    // Trigger high smoke via API
    cy.request('POST', '/api/scenarios/singleAlarm');

    // Wait for alarm
    cy.get('[data-testid="alarm-indicator"]', { timeout: 5000 })
      .should('be.visible');
    cy.get('[data-testid="room2"]').should('have.class', 'alarm');

    // Silence alarm
    cy.get('[data-testid="silence-button"]').click();
    cy.get('[data-testid="alarm-sound"]').should('not.exist');
  });
});
```

### 4. Load Testing

```javascript
// Artillery configuration
const artillery = {
  config: {
    target: 'http://localhost:3001',
    phases: [
      { duration: 60, arrivalRate: 10 },  // Warm up
      { duration: 120, arrivalRate: 50 }, // Normal load
      { duration: 60, arrivalRate: 100 }  // Stress test
    ]
  },
  scenarios: [
    {
      name: 'Sensor Data Flow',
      flow: [
        { get: { url: '/api/sensors' } },
        { get: { url: '/api/system/status' } },
        { think: 1 },
        { post: {
            url: '/api/scenarios/normal',
            json: {}
          }
        }
      ]
    }
  ]
};
```

---

## Future Enhancement Recommendations

### High Priority

1. **Authentication System**
   - JWT-based auth
   - Role-based access control (Admin, Operator, Viewer)
   - OAuth2 integration

2. **Persistent Storage**
   - PostgreSQL for sensor history
   - 30-day rolling window
   - Aggregated statistics tables

3. **Security Hardening**
   - Input validation
   - MQTT authentication
   - SSL/TLS everywhere
   - Rate limiting

4. **Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Alert manager
   - Health checks

### Medium Priority

5. **Mobile Application**
   - React Native app
   - Push notifications
   - Offline support

6. **Historical Analysis**
   - Time-series charts
   - Export to CSV/Excel
   - Alarm history log
   - Performance reports

7. **Multi-Building Support**
   - Building hierarchy
   - Centralized dashboard
   - Cross-building analytics

8. **Advanced Scenarios**
   - Schedule-based scenarios
   - Conditional triggers
   - Scenario recordings/playback

### Low Priority

9. **Machine Learning**
   - Anomaly detection
   - Predictive maintenance
   - Fire risk scoring

10. **Integration APIs**
    - REST webhooks
    - GraphQL API
    - MQTT bridge to cloud platforms

11. **Accessibility**
    - WCAG 2.1 compliance
    - Screen reader support
    - Keyboard navigation

---

## Conclusion

### Summary

This Smart Building IoT Alarm System demonstrates **excellent software engineering practices** with a clean, maintainable architecture. The recent v2.0.0 updates show active development and attention to user feedback (alarm sound fix, Polish translation).

**Strengths:**
- ⭐ Well-architected microservices
- ⭐ Real-time bidirectional communication
- ⭐ Comprehensive test scenario system
- ⭐ Excellent documentation
- ⭐ Docker containerization

**Critical Issues:**
- ⚠️ Production security (authentication, HTTPS, validation)
- ⚠️ No persistent storage
- ⚠️ Missing monitoring/alerting
- ⚠️ No automated tests

### Recommendations Priority

**Immediate (Pre-Production):**
1. Add authentication to all services
2. Implement HTTPS/WSS/MQTTS
3. Add input validation
4. Implement rate limiting
5. Add health checks

**Short-term (First Month):**
6. Implement PostgreSQL storage
7. Add Prometheus monitoring
8. Write unit tests
9. Set up CI/CD pipeline
10. Add backup strategy

**Long-term (3-6 Months):**
11. Kubernetes deployment
12. Multi-building support
13. Mobile application
14. Machine learning features

### Final Assessment

**Development Quality: 8/10**
**Production Readiness: 4/10**
**Documentation: 9/10**
**Innovation: 7/10**
**Maintainability: 8/10**

**Overall: Strong foundation requiring security hardening before production deployment**

---

**End of Analysis**
*Generated: 2025-11-17*
*Analyzer: Claude Code*
*Branch: master (latest commit: b488a2d)*
