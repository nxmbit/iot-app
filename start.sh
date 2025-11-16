#!/bin/bash

# Smart Building Alarm System - Development Startup Script

echo "🏗️  Starting Smart Building Alarm System..."
echo "================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Function to stop all services
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    docker-compose down
    exit 0
}

# Set up trap for clean shutdown
trap cleanup INT TERM

# Build and start services
echo "📦 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 5

# Check service health
echo ""
echo "🔍 Checking service status..."
echo "================================"

# Check MQTT Broker
if nc -zv localhost 1883 2>/dev/null; then
    echo "✅ MQTT Broker: Running on port 1883"
else
    echo "❌ MQTT Broker: Not responding"
fi

# Check Backend API
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend API: Running on port 3001"
else
    echo "❌ Backend API: Not responding"
fi

# Check WebSocket
if nc -zv localhost 8080 2>/dev/null; then
    echo "✅ WebSocket Server: Running on port 8080"
else
    echo "❌ WebSocket Server: Not responding"
fi

# Check Frontend
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend Dashboard: Running on port 3000"
else
    echo "❌ Frontend Dashboard: Not responding"
fi

echo ""
echo "================================"
echo "🎉 Smart Building Alarm System is ready!"
echo ""
echo "📊 Dashboard: http://localhost:3000"
echo "🔌 API: http://localhost:3001"
echo "🔗 WebSocket: ws://localhost:8080"
echo "📡 MQTT Broker: mqtt://localhost:1883"
echo ""
echo "Press Ctrl+C to stop all services"
echo "================================"

# Follow logs
docker-compose logs -f