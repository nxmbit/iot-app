#!/usr/bin/env node

/**
 * Test Script for Smart Building Alarm System
 * This script simulates various alarm scenarios for testing
 */

const mqtt = require('mqtt');

// Configuration
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

// Test scenarios
const scenarios = {
  normal: {
    name: 'Normal Operation',
    description: 'All sensors reading normal levels',
    execute: (client) => {
      for (let i = 1; i <= 6; i++) {
        const smokeLevel = Math.random() * 10; // 0-10%
        client.publish(`building/floor1/room${i}/smoke`, smokeLevel.toString());
        client.publish(`building/floor1/room${i}/status`, 'normal');
      }
    }
  },
  
  singleAlarm: {
    name: 'Single Room Alarm',
    description: 'High smoke level in Kitchen (Room 2)',
    execute: (client) => {
      // Normal levels for most rooms
      [1, 3, 4, 5, 6].forEach(room => {
        const smokeLevel = Math.random() * 10;
        client.publish(`building/floor1/room${room}/smoke`, smokeLevel.toString());
      });
      // High level in kitchen
      client.publish('building/floor1/room2/smoke', '75');
      client.publish('building/floor1/room2/status', 'alarm');
    }
  },
  
  multipleAlarms: {
    name: 'Multiple Room Alarms',
    description: 'High smoke levels in multiple rooms',
    execute: (client) => {
      const alarmRooms = [2, 3, 5];
      for (let i = 1; i <= 6; i++) {
        const smokeLevel = alarmRooms.includes(i) ? 60 + Math.random() * 30 : Math.random() * 10;
        client.publish(`building/floor1/room${i}/smoke`, smokeLevel.toString());
        client.publish(`building/floor1/room${i}/status`, smokeLevel > 50 ? 'alarm' : 'normal');
      }
    }
  },
  
  gradualIncrease: {
    name: 'Gradual Smoke Increase',
    description: 'Simulating gradual smoke buildup in Room 1',
    execute: (client) => {
      let level = 0;
      const interval = setInterval(() => {
        level += 5;
        client.publish('building/floor1/room1/smoke', level.toString());
        console.log(`Room 1 smoke level: ${level}%`);
        
        if (level >= 80) {
          clearInterval(interval);
          console.log('Peak reached, maintaining high level');
        }
      }, 1000);
    }
  },
  
  intermittent: {
    name: 'Intermittent Spikes',
    description: 'Random spikes simulating cooking/steam',
    execute: (client) => {
      setInterval(() => {
        const room = Math.floor(Math.random() * 6) + 1;
        const spike = Math.random() < 0.3;
        const level = spike ? 30 + Math.random() * 25 : Math.random() * 10;
        
        client.publish(`building/floor1/room${room}/smoke`, level.toString());
        if (spike) {
          console.log(`Spike in Room ${room}: ${level.toFixed(1)}%`);
        }
      }, 2000);
    }
  },
  
  systemTest: {
    name: 'Full System Test',
    description: 'Testing all sensor states sequentially',
    execute: async (client) => {
      const states = ['normal', 'warning', 'alarm', 'offline'];
      const levels = [5, 35, 65, 0];
      
      for (let state = 0; state < states.length; state++) {
        console.log(`\nSetting all sensors to: ${states[state]}`);
        for (let room = 1; room <= 6; room++) {
          client.publish(`building/floor1/room${room}/smoke`, levels[state].toString());
          client.publish(`building/floor1/room${room}/status`, states[state]);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
};

// Main execution
function main() {
  const args = process.argv.slice(2);
  const scenarioName = args[0] || 'normal';
  
  if (scenarioName === 'list') {
    console.log('\nAvailable test scenarios:');
    console.log('========================');
    Object.keys(scenarios).forEach(key => {
      console.log(`\n${key}:`);
      console.log(`  ${scenarios[key].name}`);
      console.log(`  ${scenarios[key].description}`);
    });
    console.log('\nUsage: node test-scenarios.js [scenario_name]');
    return;
  }
  
  const scenario = scenarios[scenarioName];
  
  if (!scenario) {
    console.error(`Unknown scenario: ${scenarioName}`);
    console.log('Use "node test-scenarios.js list" to see available scenarios');
    return;
  }
  
  console.log(`\n🧪 Running Test Scenario: ${scenario.name}`);
  console.log(`📝 ${scenario.description}`);
  console.log('================================\n');
  
  // Connect to MQTT
  const client = mqtt.connect(MQTT_BROKER_URL);
  
  client.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    console.log('🚀 Executing scenario...\n');
    scenario.execute(client);
    
    // Keep connection alive for streaming scenarios
    if (!['gradualIncrease', 'intermittent', 'systemTest'].includes(scenarioName)) {
      setTimeout(() => {
        console.log('\n✅ Scenario completed');
        client.end();
      }, 2000);
    }
  });
  
  client.on('error', (err) => {
    console.error('❌ MQTT Error:', err);
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping test scenario...');
    client.end();
    process.exit(0);
  });
}

// Check if mqtt module is available
try {
  require.resolve('mqtt');
  main();
} catch(e) {
  console.log('Installing required dependencies...');
  require('child_process').execSync('npm install mqtt', {stdio: 'inherit'});
  main();
}
