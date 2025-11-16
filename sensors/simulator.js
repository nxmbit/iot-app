const mqtt = require('mqtt');
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

// Configuration
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const SIMULATION_MODE = process.env.SIMULATION_MODE || 'realistic';
const NUM_ROOMS = parseInt(process.env.NUM_ROOMS) || 6;

// Sensor class
class SmokeSensor {
  constructor(roomId, roomName) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.smokeLevel = 0;
    this.threshold = 50;
    this.sensitivity = 1.0;
    this.baselineNoise = 0;
    this.isOnline = true;
    this.simulationMode = SIMULATION_MODE;
    this.fireSimulation = null;
    this.lastPublish = Date.now();
    
    // Simulation parameters
    this.smokeGrowthRate = 0.5 + Math.random() * 0.5;
    this.smokeDecayRate = 0.3 + Math.random() * 0.2;
    this.noiseLevel = 2;
    this.fireStartProbability = 0.001; // 0.1% chance per update
    this.fireDuration = 0;
    this.maxFireDuration = 60000; // 60 seconds
  }

  updateSmokeLevel() {
    switch(this.simulationMode) {
      case 'realistic':
        this.realisticSimulation();
        break;
      case 'random':
        this.randomSimulation();
        break;
      case 'test':
        this.testSimulation();
        break;
      default:
        this.realisticSimulation();
    }
    
    // Ensure smoke level stays within bounds
    this.smokeLevel = Math.max(0, Math.min(100, this.smokeLevel));
  }

  realisticSimulation() {
    // Baseline noise (cooking, dust, etc.)
    this.baselineNoise = Math.sin(Date.now() / 10000) * 2 + Math.random() * this.noiseLevel;
    
    // Random fire event
    if (!this.fireSimulation && Math.random() < this.fireStartProbability) {
      this.startFire();
    }
    
    if (this.fireSimulation) {
      // Fire is active
      const fireIntensity = this.fireSimulation.intensity;
      const targetLevel = fireIntensity * 100;
      
      // Smoke grows towards target with some randomness
      const growth = (targetLevel - this.smokeLevel) * this.smokeGrowthRate * 0.1;
      this.smokeLevel += growth + (Math.random() - 0.5) * 5;
      
      this.fireDuration += 1000;
      
      // Fire might spread or diminish
      if (Math.random() < 0.05) {
        this.fireSimulation.intensity = Math.min(1, this.fireSimulation.intensity + 0.1);
      }
      
      // Fire eventually dies down
      if (this.fireDuration > this.maxFireDuration || Math.random() < 0.01) {
        this.endFire();
      }
    } else {
      // Normal operation - slow decay with noise
      this.smokeLevel = this.smokeLevel * (1 - this.smokeDecayRate * 0.01) + this.baselineNoise;
      
      // Occasional small spikes (cooking, steam, etc.)
      if (Math.random() < 0.005) {
        this.smokeLevel += Math.random() * 20;
      }
    }
  }

  randomSimulation() {
    // Simple random walk
    const change = (Math.random() - 0.5) * 10;
    this.smokeLevel += change;
    
    // Occasional spikes
    if (Math.random() < 0.02) {
      this.smokeLevel += Math.random() * 30;
    }
    
    // Gradual decay
    this.smokeLevel *= 0.95;
  }

  testSimulation() {
    // Predictable pattern for testing
    const cycle = (Date.now() / 1000) % 120;
    
    if (cycle < 30) {
      this.smokeLevel = 10 + Math.sin(cycle / 5) * 5;
    } else if (cycle < 60) {
      this.smokeLevel = 30 + Math.sin(cycle / 3) * 10;
    } else if (cycle < 90) {
      this.smokeLevel = 60 + Math.sin(cycle / 2) * 20;
    } else {
      this.smokeLevel = 20 + Math.sin(cycle / 4) * 10;
    }
  }

  startFire() {
    logger.warn(`Fire simulation started in ${this.roomName}`);
    this.fireSimulation = {
      startTime: Date.now(),
      intensity: 0.3 + Math.random() * 0.4,
      type: Math.random() < 0.5 ? 'electrical' : 'combustion'
    };
    this.fireDuration = 0;
  }

  endFire() {
    logger.info(`Fire simulation ended in ${this.roomName}`);
    this.fireSimulation = null;
    this.fireDuration = 0;
  }

  reset() {
    this.smokeLevel = 0;
    this.fireSimulation = null;
    this.fireDuration = 0;
    logger.info(`Sensor reset in ${this.roomName}`);
  }

  setThreshold(value) {
    this.threshold = value;
    logger.info(`Threshold updated to ${value} for ${this.roomName}`);
  }

  setSensitivity(value) {
    this.sensitivity = value;
    logger.info(`Sensitivity updated to ${value} for ${this.roomName}`);
  }

  triggerTest() {
    logger.info(`Test alarm triggered for ${this.roomName}`);
    this.smokeLevel = this.threshold + 20;
  }

  getStatus() {
    if (!this.isOnline) return 'offline';
    if (this.smokeLevel > this.threshold) return 'alarm';
    if (this.smokeLevel > this.threshold * 0.7) return 'warning';
    return 'normal';
  }
}

// Sensor Manager
class SensorManager {
  constructor() {
    this.sensors = new Map();
    this.mqttClient = null;
    this.publishInterval = null;
    this.heartbeatInterval = null;
  }

  initialize() {
    // Create sensors for each room
    for (let i = 1; i <= NUM_ROOMS; i++) {
      const roomId = `room${i}`;
      const roomNames = [
        'Living Room', 'Kitchen', 'Bedroom 1', 
        'Bedroom 2', 'Bathroom', 'Office'
      ];
      const roomName = roomNames[i - 1] || `Room ${i}`;
      
      const sensor = new SmokeSensor(roomId, roomName);
      this.sensors.set(roomId, sensor);
      logger.info(`Initialized sensor for ${roomName} (${roomId})`);
    }

    // Connect to MQTT broker
    this.connectMQTT();
  }

  connectMQTT() {
    this.mqttClient = mqtt.connect(MQTT_BROKER_URL, {
      clientId: `sensor_simulator_${Math.random().toString(16).slice(3)}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    });

    this.mqttClient.on('connect', () => {
      logger.info('Connected to MQTT broker');
      this.subscribeToTopics();
      this.startSimulation();
    });

    this.mqttClient.on('error', (err) => {
      logger.error('MQTT error:', err);
    });

    this.mqttClient.on('message', (topic, message) => {
      this.handleMessage(topic, message.toString());
    });

    this.mqttClient.on('close', () => {
      logger.warn('MQTT connection closed');
    });
  }

  subscribeToTopics() {
    const topics = [];
    
    this.sensors.forEach((sensor, roomId) => {
      topics.push(`building/floor1/${roomId}/reset`);
      topics.push(`building/floor1/${roomId}/threshold`);
      topics.push(`building/floor1/${roomId}/config`);
      topics.push(`building/floor1/${roomId}/test`);
    });

    this.mqttClient.subscribe(topics, (err) => {
      if (err) {
        logger.error('Subscription error:', err);
      } else {
        logger.info(`Subscribed to ${topics.length} control topics`);
      }
    });
  }

  handleMessage(topic, message) {
    const topicParts = topic.split('/');
    if (topicParts[0] !== 'building' || topicParts[1] !== 'floor1') {
      return;
    }

    const roomId = topicParts[2];
    const command = topicParts[3];
    const sensor = this.sensors.get(roomId);

    if (!sensor) {
      logger.warn(`No sensor found for room: ${roomId}`);
      return;
    }

    switch(command) {
      case 'reset':
        sensor.reset();
        break;
      
      case 'threshold':
        const threshold = parseFloat(message);
        if (!isNaN(threshold)) {
          sensor.setThreshold(threshold);
        }
        break;
      
      case 'config':
        try {
          const config = JSON.parse(message);
          if (config.sensitivity !== undefined) {
            sensor.setSensitivity(config.sensitivity);
          }
          if (config.mode !== undefined) {
            sensor.simulationMode = config.mode;
          }
        } catch (err) {
          logger.error('Invalid config message:', err);
        }
        break;
      
      case 'test':
        sensor.triggerTest();
        break;
    }
  }

  startSimulation() {
    // Publish sensor data at regular intervals
    this.publishInterval = setInterval(() => {
      this.sensors.forEach((sensor, roomId) => {
        // Update sensor values
        sensor.updateSmokeLevel();
        
        // Publish smoke level
        const smokeTopic = `building/floor1/${roomId}/smoke`;
        this.mqttClient.publish(smokeTopic, sensor.smokeLevel.toFixed(2), {
          qos: 1,
          retain: true
        });
        
        // Publish status
        const statusTopic = `building/floor1/${roomId}/status`;
        this.mqttClient.publish(statusTopic, sensor.getStatus(), {
          qos: 1,
          retain: true
        });
        
        // Log high readings
        if (sensor.smokeLevel > sensor.threshold) {
          logger.warn(`High smoke level in ${sensor.roomName}: ${sensor.smokeLevel.toFixed(2)}`);
        }
      });
    }, 1000); // Update every second

    // Send heartbeat messages
    this.heartbeatInterval = setInterval(() => {
      this.sensors.forEach((sensor, roomId) => {
        const heartbeatTopic = `building/floor1/${roomId}/heartbeat`;
        this.mqttClient.publish(heartbeatTopic, new Date().toISOString(), {
          qos: 0
        });
      });
    }, 5000); // Heartbeat every 5 seconds

    logger.info('Simulation started');
  }

  stop() {
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.mqttClient) {
      this.mqttClient.end();
    }
    logger.info('Simulation stopped');
  }
}

// Main execution
const manager = new SensorManager();
manager.initialize();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  manager.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  manager.stop();
  process.exit(0);
});

logger.info('Smart Building Sensor Simulator Started');
logger.info(`Simulating ${NUM_ROOMS} rooms in ${SIMULATION_MODE} mode`);
