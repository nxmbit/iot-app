import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import './HistoryChart.css';

const HistoryChart = ({ data, threshold, roomName }) => {
  // Prepare data for chart
  const chartData = data.slice(-30); // Show last 30 readings

  return (
    <div className="history-chart">
      <div className="chart-header">
        <h3>Smoke Level History - {roomName}</h3>
        <span className="chart-info">Last 30 readings</span>
      </div>
      
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              label={{ value: 'Smoke Level (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip 
              formatter={(value) => `${value.toFixed(1)}%`}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            <ReferenceLine 
              y={threshold} 
              label="Alarm Threshold" 
              stroke="#e74c3c" 
              strokeDasharray="5 5"
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#3498db" 
              strokeWidth={2}
              dot={false}
              name="Smoke Level"
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="no-data">
          No historical data available yet
        </div>
      )}
    </div>
  );
};

export default HistoryChart;
