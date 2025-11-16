# Deployment Guide - Smart Building Alarm System

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Manual Installation](#manual-installation)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 1.29 or higher
- **Node.js**: Version 18 or higher (for development)
- **Git**: For version control

### Hardware Requirements
- **Minimum**: 2 CPU cores, 4GB RAM, 10GB disk space
- **Recommended**: 4 CPU cores, 8GB RAM, 20GB disk space

### Network Requirements
- Ports 1883 (MQTT), 3000 (Frontend), 3001 (API), 8080 (WebSocket)

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd smart-building-alarm

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access the dashboard
# Open browser: http://localhost:3000
```

### Using the Start Script

```bash
# Make script executable
chmod +x start.sh

# Run the system
./start.sh
```

## Manual Installation

### 1. Install and Start MQTT Broker

```bash
# Using Docker
docker run -d \
  --name mosquitto \
  -p 1883:1883 \
  -p 9001:9001 \
  -v $(pwd)/mosquitto/config:/mosquitto/config \
  eclipse-mosquitto

# Or install locally (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install mosquitto mosquitto-clients
sudo systemctl start mosquitto
```

### 2. Install and Start Backend

```bash
cd backend
npm install
npm start

# For development with auto-reload
npm run dev
```

### 3. Install and Start Sensors

```bash
cd sensors
npm install
npm start

# Configure simulation mode (optional)
export SIMULATION_MODE=realistic  # or 'random', 'test'
npm start
```

### 4. Install and Start Frontend

```bash
cd frontend
npm install
npm start

# For production build
npm run build
```

## Configuration

### Backend Configuration (backend/.env)

```env
# MQTT Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=backend_server

# Server Ports
API_PORT=3001
WS_PORT=8080

# Environment
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

### Sensor Configuration (sensors/.env)

```env
# MQTT Configuration
MQTT_BROKER_URL=mqtt://localhost:1883

# Simulation Settings
SIMULATION_MODE=realistic
NUM_ROOMS=6
UPDATE_INTERVAL=1000

# Alarm Thresholds
DEFAULT_THRESHOLD=50
```

### Frontend Configuration (frontend/.env)

```env
# API Endpoints
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:8080

# Features
REACT_APP_ENABLE_NOTIFICATIONS=true
REACT_APP_ENABLE_SOUND=true
```

### Docker Compose Environment Variables

```yaml
# Override in docker-compose.override.yml
version: '3.8'
services:
  backend:
    environment:
      - LOG_LEVEL=debug
  sensors:
    environment:
      - SIMULATION_MODE=test
```

## Testing

### Running Test Scenarios

```bash
# List available scenarios
node test-scenarios.js list

# Run specific scenario
node test-scenarios.js singleAlarm
node test-scenarios.js multipleAlarms
node test-scenarios.js gradualIncrease
```

### Manual MQTT Testing

```bash
# Subscribe to all topics
mosquitto_sub -h localhost -t "building/#" -v

# Publish test message
mosquitto_pub -h localhost -t "building/floor1/room1/smoke" -m "45.5"

# Trigger alarm
mosquitto_pub -h localhost -t "building/floor1/room2/smoke" -m "75"
```

### API Testing

```bash
# Health check
curl http://localhost:3001/api/health

# Get all sensors
curl http://localhost:3001/api/sensors

# Get specific sensor
curl http://localhost:3001/api/sensors/room1

# Update threshold
curl -X POST http://localhost:3001/api/sensors/room1/config \
  -H "Content-Type: application/json" \
  -d '{"threshold": 60}'

# Reset alarm
curl -X POST http://localhost:3001/api/sensors/room1/reset
```

## Production Deployment

### 1. Using Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml smart-building

# Scale services
docker service scale smart-building_backend=3
```

### 2. Using Kubernetes

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: smart-building-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: smart-building-backend:latest
        ports:
        - containerPort: 3001
        - containerPort: 8080
```

### 3. Cloud Deployment (AWS Example)

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [ECR_URI]
docker build -t smart-building-backend ./backend
docker tag smart-building-backend:latest [ECR_URI]/smart-building-backend:latest
docker push [ECR_URI]/smart-building-backend:latest

# Deploy using ECS/Fargate or EKS
```

### 4. Environment-Specific Configuration

```javascript
// Production configuration example
const config = {
  mqtt: {
    url: process.env.MQTT_BROKER_URL || 'mqtts://mqtt.production.com:8883',
    options: {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      rejectUnauthorized: true,
      ca: fs.readFileSync('ca.crt')
    }
  },
  ssl: {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
  }
};
```

## Monitoring

### Prometheus Metrics

Add metrics endpoint to backend:

```javascript
// backend/metrics.js
const prometheus = require('prom-client');
const register = new prometheus.Registry();

// Define metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

register.registerMetric(httpRequestDuration);
```

### Health Checks

```yaml
# docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Troubleshooting

### Common Issues

#### 1. MQTT Connection Failed
```bash
# Check if Mosquitto is running
docker ps | grep mosquitto

# Test connection
mosquitto_pub -h localhost -p 1883 -t test -m "test"

# Check logs
docker logs mosquitto
```

#### 2. WebSocket Connection Issues
```bash
# Check if port is open
netstat -an | grep 8080

# Test WebSocket
wscat -c ws://localhost:8080
```

#### 3. Frontend Can't Connect to Backend
```bash
# Check CORS settings
# Ensure backend allows origin http://localhost:3000

# Check network
curl -I http://localhost:3001/api/health
```

#### 4. High CPU Usage
```bash
# Check sensor simulation settings
# Reduce update frequency or number of rooms
export UPDATE_INTERVAL=5000
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=*
export LOG_LEVEL=debug

# Run with verbose output
docker-compose up --verbose
```

### Log Locations

- **Mosquitto**: `./mosquitto/log/mosquitto.log`
- **Backend**: Console output or `./backend/logs/`
- **Frontend**: Browser console
- **Docker**: `docker logs [container_name]`

## Security Considerations

1. **MQTT Security**:
   - Enable authentication: `allow_anonymous false`
   - Use TLS/SSL for encryption
   - Implement ACL for topic permissions

2. **API Security**:
   - Add JWT authentication
   - Implement rate limiting
   - Use HTTPS in production

3. **WebSocket Security**:
   - Implement WSS (WebSocket Secure)
   - Add origin validation
   - Implement connection limits

4. **Frontend Security**:
   - Enable Content Security Policy (CSP)
   - Implement input validation
   - Use environment variables for sensitive data

## Performance Optimization

1. **MQTT Optimization**:
   - Use QoS 0 for non-critical data
   - Implement message batching
   - Set appropriate keep-alive intervals

2. **Backend Optimization**:
   - Implement caching (Redis)
   - Use connection pooling
   - Enable compression

3. **Frontend Optimization**:
   - Implement lazy loading
   - Use React.memo for components
   - Optimize WebSocket reconnection logic

## Backup and Recovery

```bash
# Backup Mosquitto data
docker run --rm -v mosquitto_data:/data -v $(pwd):/backup alpine tar czf /backup/mosquitto_backup.tar.gz /data

# Restore Mosquitto data
docker run --rm -v mosquitto_data:/data -v $(pwd):/backup alpine tar xzf /backup/mosquitto_backup.tar.gz
```

## Support

For issues or questions:
1. Check the [README.md](README.md)
2. Review logs for error messages
3. Test individual components separately
4. Create an issue in the repository
