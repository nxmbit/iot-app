# MQTT-Based Smart Building Alarm System

A full-stack IoT simulation project featuring real-time monitoring and control of smoke sensors in a smart building.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Web Dashboard (React)                  │
│  - Real-time floor plan visualization                    │
│  - Sensor status monitoring                              │
│  - Alarm controls and sound alerts                       │
│  - Sensor configuration interface                        │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket & HTTP
┌────────────────────┴────────────────────────────────────┐
│               Backend API (Node.js/Express)              │
│  - WebSocket server for real-time updates                │
│  - REST API for sensor configuration                     │
│  - MQTT client for broker communication                  │
│  - Data aggregation and processing                       │
└────────────────────┬────────────────────────────────────┘
                     │ MQTT
┌────────────────────┴────────────────────────────────────┐
│                    MQTT Broker (Mosquitto)               │
│  - Message routing between sensors and backend           │
│  - Topic-based pub/sub messaging                         │
└────────────────────┬────────────────────────────────────┘
                     │ MQTT
┌────────────────────┴────────────────────────────────────┐
│              Simulated Sensors (Node.js)                 │
│  - Multiple room sensors (smoke detection)               │
│  - Configurable smoke level simulation                   │
│  - Responds to configuration commands                    │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ and npm
- Modern web browser

### Installation & Running

1. Clone the repository:
```bash
git clone <repository-url>
cd smart-building-alarm
```

2. Start all services using Docker Compose:
```bash
docker-compose up --build
```

3. Access the dashboard:
```
http://localhost:3000
```

### Alternative: Run Components Individually

#### 1. Start MQTT Broker:
```bash
docker run -it -p 1883:1883 -p 9001:9001 eclipse-mosquitto
```

#### 2. Start Backend:
```bash
cd backend
npm install
npm start
```

#### 3. Start Sensors:
```bash
cd sensors
npm install
npm start
```

#### 4. Start Frontend:
```bash
cd frontend
npm install
npm start
```

## 📊 MQTT Topics

### Sensor Data Topics:
- `building/floor1/room{1-6}/smoke` - Smoke level readings (0-100)
- `building/floor1/room{1-6}/status` - Sensor status (online/offline/alarm)

### Control Topics:
- `building/floor1/room{1-6}/config` - Sensor configuration commands
- `building/floor1/room{1-6}/reset` - Reset sensor alarm
- `building/floor1/room{1-6}/threshold` - Set alarm threshold

### System Topics:
- `building/system/status` - System-wide status updates
- `building/system/alarm` - Building-wide alarm status

## 🎯 Features

- **Real-time Monitoring**: Live updates of all sensor readings
- **Interactive Floor Plan**: Visual representation of building layout
- **Alarm System**: Audio and visual alerts when smoke detected
- **Sensor Configuration**: Adjust thresholds and sensitivity
- **Historical Data**: View sensor reading history
- **Multi-room Support**: Monitor up to 6 rooms simultaneously
- **Responsive Design**: Works on desktop and mobile devices

## 🔧 Configuration

### Sensor Configuration (sensors/config.json):
```json
{
  "rooms": [
    {
      "id": "room1",
      "name": "Living Room",
      "threshold": 50,
      "simulationMode": "random"
    }
  ]
}
```

### Backend Configuration (backend/.env):
```
MQTT_BROKER_URL=mqtt://localhost:1883
WS_PORT=8080
API_PORT=3001
```

## 📝 API Documentation

### REST Endpoints:
- `GET /api/sensors` - Get all sensor statuses
- `GET /api/sensors/:roomId` - Get specific sensor data
- `POST /api/sensors/:roomId/config` - Update sensor configuration
- `POST /api/sensors/:roomId/reset` - Reset sensor alarm

### WebSocket Events:
- `sensor-update` - Real-time sensor data
- `alarm-trigger` - Alarm activation event
- `system-status` - System status updates

## 🏗️ Development

### Project Structure:
```
smart-building-alarm/
├── frontend/           # React dashboard
├── backend/           # Node.js API server
├── sensors/           # Simulated IoT sensors
├── docker-compose.yml # Container orchestration
└── README.md         # Documentation
```

## 📄 License

MIT License
