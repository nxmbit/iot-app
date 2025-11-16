import React from 'react';
import './FloorPlan.css';

const FloorPlan = ({ sensors, selectedRoom, onRoomSelect }) => {
  const getRoomColor = (sensor) => {
    if (!sensor) return '#f0f0f0';
    if (sensor.isAlarmActive) return '#ff4444';
    if (sensor.status === 'warning') return '#ffaa00';
    if (sensor.smokeLevel > 0) {
      // Gradient from light blue to yellow based on smoke level
      const intensity = Math.min(sensor.smokeLevel / sensor.threshold, 1);
      return `rgba(255, 200, 100, ${0.2 + intensity * 0.6})`;
    }
    return '#e8f5e9';
  };

  const getSmokeOpacity = (sensor) => {
    if (!sensor) return 0;
    return Math.min(sensor.smokeLevel / 100, 0.7);
  };

  return (
    <div className="floor-plan-container">
      <svg width="600" height="350" viewBox="0 0 600 350" className="floor-plan-svg">
        {/* Building Outline */}
        <rect 
          x="5" y="5" 
          width="590" height="340" 
          fill="none" 
          stroke="#333" 
          strokeWidth="3"
          rx="5"
        />
        
        {/* Room Layout */}
        {sensors.map(sensor => {
          const room = sensor.position || {};
          const dimensions = sensor.dimensions || {};
          const x = room.x || 10;
          const y = room.y || 10;
          const width = dimensions.width || 180;
          const height = dimensions.height || 150;
          const isSelected = selectedRoom === sensor.roomId;
          
          return (
            <g key={sensor.roomId}>
              {/* Room Rectangle */}
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={getRoomColor(sensor)}
                stroke={isSelected ? '#007bff' : '#666'}
                strokeWidth={isSelected ? 3 : 1}
                className="room"
                onClick={() => onRoomSelect(sensor.roomId)}
                style={{ cursor: 'pointer' }}
              />
              
              {/* Smoke Effect */}
              {sensor.smokeLevel > 5 && (
                <rect
                  x={x + 5}
                  y={y + 5}
                  width={width - 10}
                  height={height - 10}
                  fill="gray"
                  opacity={getSmokeOpacity(sensor)}
                  pointerEvents="none"
                  className="smoke-effect"
                />
              )}
              
              {/* Room Label */}
              <text
                x={x + width / 2}
                y={y + height / 2 - 20}
                textAnchor="middle"
                className="room-label"
                pointerEvents="none"
              >
                {sensor.roomName}
              </text>
              
              {/* Smoke Level */}
              <text
                x={x + width / 2}
                y={y + height / 2 + 5}
                textAnchor="middle"
                className="smoke-level"
                pointerEvents="none"
              >
                {sensor.smokeLevel.toFixed(1)}%
              </text>
              
              {/* Status Indicator */}
              {sensor.isAlarmActive && (
                <>
                  <circle
                    cx={x + width - 20}
                    cy={y + 20}
                    r="10"
                    fill="#ff0000"
                    className="alarm-dot"
                  />
                  <text
                    x={x + width - 20}
                    y={y + 25}
                    textAnchor="middle"
                    fill="white"
                    fontSize="14"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    !
                  </text>
                </>
              )}
              
              {/* Sensor Icon */}
              <circle
                cx={x + 20}
                cy={y + 20}
                r="8"
                fill={sensor.connectionStatus === 'online' ? '#4caf50' : '#999'}
                stroke="white"
                strokeWidth="2"
              />
            </g>
          );
        })}
        
        {/* Legend */}
        <g transform="translate(10, 330)">
          <text x="0" y="0" fontSize="10" fill="#666">Legenda:</text>
          <circle cx="60" cy="-3" r="5" fill="#4caf50" />
          <text x="70" y="0" fontSize="10" fill="#666">Online</text>
          <circle cx="120" cy="-3" r="5" fill="#ffaa00" />
          <text x="130" y="0" fontSize="10" fill="#666">Ostrzeżenie</text>
          <circle cx="180" cy="-3" r="5" fill="#ff4444" />
          <text x="190" y="0" fontSize="10" fill="#666">Alarm</text>
        </g>
      </svg>
    </div>
  );
};

export default FloorPlan;
