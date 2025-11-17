# Smart Building Alarm System - Refactoring Documentation

## Overview
This document describes the refactoring and new features implemented to introduce explicit user-driven alarm/reset scenarios and manual smoke level persistence.

## Date
2025-11-17

## Changes Implemented

### 1. Backend Refactoring (server.js)

#### State Management
- **Added `isManuallySet` flag** to sensor state structure (line 53)
  - Tracks whether a room's smoke level was manually set by the user
  - Prevents automatic sensor updates from overriding manual values

#### MQTT Message Handling
- **Updated smoke message handler** (lines 168-173)
  - Now checks `isManuallySet` flag before applying automatic updates
  - Skips automatic updates when flag is `true`
  - Logs when automatic updates are skipped

#### New Control Functions

##### `triggerRoomAlarm(roomId)` (lines 316-347)
- Activates alarm for a specific room
- Sets smoke level above threshold
- Marks as manually set to persist
- Publishes to MQTT and broadcasts to WebSocket clients

##### `triggerGlobalAlarm()` (lines 352-363)
- Activates alarms for all rooms in the system
- Iterates through all rooms and calls `triggerRoomAlarm()` for each
- Broadcasts global alarm trigger event

##### `resetRoomStatus(roomId)` (lines 369-399)
- Clears alarm and resets smoke level to 0
- **Clears `isManuallySet` flag** to allow automatic updates
- Publishes reset to MQTT and broadcasts to WebSocket clients

##### `resetGlobalStatus()` (lines 404-415)
- Resets all rooms in the system
- Calls `resetRoomStatus()` for each room
- Broadcasts global reset event

##### `setManualSmokeLevel(roomId, smokeLevel)` (lines 421-464)
- Manually sets smoke level for a specific room
- **Sets `isManuallySet` flag to `true`**
- Updates status and alarm based on new smoke level
- Persists until reset is called

#### WebSocket Message Handlers (lines 118-134)
Added new message type handlers:
- `trigger-room-alarm`
- `trigger-global-alarm`
- `reset-room-status`
- `reset-global-status`
- `set-manual-smoke-level`

#### REST API Endpoints (lines 525-570)
Added new API endpoints:
- `POST /api/sensors/:roomId/trigger-alarm` - Trigger alarm for specific room
- `POST /api/system/trigger-global-alarm` - Trigger alarm for all rooms
- `POST /api/sensors/:roomId/reset-status` - Reset specific room
- `POST /api/system/reset-global-status` - Reset all rooms
- `POST /api/sensors/:roomId/set-smoke-level` - Manually set smoke level (0-100)

### 2. Frontend Refactoring

#### App.js Updates

##### New Handler Functions (lines 199-222)
- `triggerRoomAlarm(roomId)` - Trigger alarm for specific room
- `triggerGlobalAlarm()` - Trigger alarm for all rooms
- `resetRoomStatus(roomId)` - Reset specific room
- `resetGlobalStatus()` - Reset all rooms
- `setManualSmokeLevel(roomId, smokeLevel)` - Set manual smoke level

##### Component Props Updates (lines 308-316)
SensorPanel now receives additional props:
- `onTriggerAlarm`
- `onResetStatus`
- `onSetSmokeLevel`

AlarmControl now receives additional props (lines 298-305):
- `onTriggerGlobalAlarm`
- `onResetGlobalStatus`

#### SensorPanel.js Updates

##### State Management (lines 7-8)
Added new state variables:
- `manualSmokeLevel` - Tracks manual smoke level input
- `isEditingSmokeLevel` - Tracks edit mode for smoke level

##### Manual Smoke Level Control (lines 39-90)
- Added inline edit button for smoke level
- Slider control (0-100%) for manual smoke level adjustment
- Visual indicator "(Manual)" badge when `isManuallySet` is true
- Set/Cancel buttons for confirmation

##### Enhanced Action Buttons (lines 136-168)
Reorganized into two action groups:
1. **Alarm Control**
   - Trigger Alarm button
   - Test Alarm button
2. **Reset Control**
   - Reset Alarm Only button (existing functionality)
   - Reset Room (Clear All) button (new - clears smoke level too)

#### SensorPanel.css Updates
Added new styles:
- `.manual-badge` - Orange badge for manual indicator
- `.smoke-level-edit` - Container for smoke level edit controls
- `.btn-inline` - Small inline button style
- `.btn-danger` - Red button for trigger alarm
- `.btn-info` - Blue button for reset alarm
- `.action-group` - Grouped action button container

#### AlarmControl.js Updates

##### Global Controls Section (lines 40-59)
Added new section with:
- "Global Controls" heading
- **Trigger All Alarms** button - Activates alarms in all rooms
- **Reset All Rooms** button - Clears all alarms and resets all smoke levels

#### AlarmControl.css Updates
Added styles for global controls:
- `.global-controls` - Container with top border
- `.global-actions` - Flex layout for global buttons
- `.btn-control.trigger-global` - Red styling for trigger all
- `.btn-control.reset-global` - Green styling for reset all

## Implementation Details

### Manual Override Persistence Flow

1. **User sets manual smoke level:**
   ```
   User Input → Frontend (setManualSmokeLevel)
              → WebSocket Command
              → Backend (setManualSmokeLevel function)
              → Sets isManuallySet = true
              → Publishes to MQTT
              → Broadcasts to WebSocket clients
   ```

2. **Automatic update attempt:**
   ```
   Sensor Simulator → MQTT Publish
                   → Backend receives message
                   → Checks isManuallySet flag
                   → If true: Skip update (line 170-172)
                   → If false: Apply update
   ```

3. **Reset clears manual override:**
   ```
   User Reset → resetRoomStatus() or resetGlobalStatus()
             → Sets isManuallySet = false
             → Sets smokeLevel = 0
             → Automatic updates resume
   ```

### Sensor Simulator Interaction

The sensor simulator (`sensors/simulator.js`) continues to publish smoke level updates via MQTT as before. The backend now filters these updates based on the `isManuallySet` flag:

- When `isManuallySet` is `false`: Normal automatic updates apply
- When `isManuallySet` is `true`: MQTT updates are ignored (backend line 170-172)
- Reset operations clear the flag, allowing automatic updates to resume

No changes to the sensor simulator were needed - the filtering happens entirely in the backend MQTT message handler.

## Testing the New Features

### 1. Manual Smoke Level Persistence
1. Select a room in the dashboard
2. Click "Edit" next to the smoke level
3. Adjust the slider to a specific value (e.g., 45%)
4. Click "Set"
5. Observe that the "(Manual)" badge appears
6. **Verify**: Smoke level stays at 45% despite simulator updates
7. Click "Reset Room (Clear All)"
8. **Verify**: Smoke level returns to 0 and automatic updates resume

### 2. Room-Specific Alarm Trigger
1. Select a room (e.g., Room 1)
2. Click "Trigger Alarm" button
3. **Verify**: Alarm activates only for Room 1
4. **Verify**: Smoke level automatically set above threshold
5. **Verify**: Manual badge appears
6. **Verify**: Audio alarm plays (if enabled)

### 3. Global Alarm Trigger
1. Click "Trigger All Alarms" button in Global Controls
2. **Verify**: All 6 rooms show alarm state
3. **Verify**: All rooms have smoke levels above threshold
4. **Verify**: All rooms show "(Manual)" badge
5. **Verify**: Audio alarm plays

### 4. Room Reset
1. Trigger alarm on a specific room
2. Click "Reset Room (Clear All)"
3. **Verify**: Alarm cleared for that room
4. **Verify**: Smoke level set to 0
5. **Verify**: Manual badge removed
6. **Verify**: Automatic updates resume

### 5. Global Reset
1. Click "Trigger All Alarms"
2. Click "Reset All Rooms" in Global Controls
3. **Verify**: All alarms cleared
4. **Verify**: All smoke levels reset to 0
5. **Verify**: All manual badges removed
6. **Verify**: Automatic updates resume for all rooms

## API Usage Examples

### Trigger Alarm for Specific Room
```bash
curl -X POST http://localhost:3001/api/sensors/room1/trigger-alarm
```

### Trigger Global Alarm
```bash
curl -X POST http://localhost:3001/api/system/trigger-global-alarm
```

### Set Manual Smoke Level
```bash
curl -X POST http://localhost:3001/api/sensors/room2/set-smoke-level \
  -H "Content-Type: application/json" \
  -d '{"smokeLevel": 65}'
```

### Reset Room Status
```bash
curl -X POST http://localhost:3001/api/sensors/room1/reset-status
```

### Reset All Rooms
```bash
curl -X POST http://localhost:3001/api/system/reset-global-status
```

## WebSocket Message Format

### Trigger Room Alarm
```json
{
  "type": "trigger-room-alarm",
  "roomId": "room1"
}
```

### Trigger Global Alarm
```json
{
  "type": "trigger-global-alarm"
}
```

### Set Manual Smoke Level
```json
{
  "type": "set-manual-smoke-level",
  "roomId": "room2",
  "smokeLevel": 45
}
```

### Reset Room Status
```json
{
  "type": "reset-room-status",
  "roomId": "room1"
}
```

### Reset Global Status
```json
{
  "type": "reset-global-status"
}
```

## File Changes Summary

### Modified Files
1. **backend/server.js** - Added state management, new control functions, API endpoints
2. **frontend/src/App.js** - Added handler functions and prop passing
3. **frontend/src/components/SensorPanel.js** - Added manual smoke level control and new buttons
4. **frontend/src/components/SensorPanel.css** - Added styling for new controls
5. **frontend/src/components/AlarmControl.js** - Added global control buttons
6. **frontend/src/components/AlarmControl.css** - Added styling for global controls

### New Files
1. **REFACTORING.md** - This documentation file

### Unchanged Files
- **sensors/simulator.js** - No changes needed; backend filters automatic updates
- **docker-compose.yml** - No changes needed
- All other configuration files remain unchanged

## Backward Compatibility

All existing functionality is preserved:
- Original reset alarm button still works (`resetAlarm()`)
- Test alarm functionality unchanged
- Threshold adjustment unchanged
- WebSocket and MQTT communication unchanged
- Sensor simulation continues normally

New features are additive and don't break existing workflows.

## Future Enhancements

Potential improvements for consideration:
1. Add timestamp tracking for when manual override was set
2. Add auto-expire option for manual overrides (e.g., after 5 minutes)
3. Add confirmation dialogs for global operations
4. Add visual history timeline showing manual interventions
5. Add role-based permissions for trigger/reset operations
6. Persist manual overrides across server restarts (database integration)

## Notes

- The `isManuallySet` flag is stored in-memory and will be lost on server restart
- Manual overrides persist until explicitly reset or server restart
- Global operations affect all 6 rooms simultaneously
- Sensor simulator continues to publish updates; backend filters them when appropriate
- No database changes required for this implementation
