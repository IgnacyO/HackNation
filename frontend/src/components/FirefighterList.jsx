import React from 'react'

// Team color mapping (same as in Map.jsx)
const getTeamColor = (team) => {
  if (!team || !team.trim()) return '#6c757d' // Gray for no team
  
  const teamColors = {
    'RIT': '#dc3545',      // Red
    'Engine 1': '#0d6efd', // Blue
    'Engine 2': '#198754', // Green
    'Engine 3': '#ffc107', // Yellow
    'Ladder 1': '#fd7e14', // Orange
    'Ladder 2': '#6f42c1', // Purple
    'Rescue 1': '#20c997', // Teal
    'Rescue 2': '#e91e63', // Pink
    'Squad 1': '#00bcd4',  // Cyan
    'Squad 2': '#795548',   // Brown
  }
  
  // Try exact match first
  if (teamColors[team]) {
    return teamColors[team]
  }
  
  // Try case-insensitive match
  const teamLower = team.toLowerCase()
  for (const [key, value] of Object.entries(teamColors)) {
    if (key.toLowerCase() === teamLower) {
      return value
    }
  }
  
  // Generate color from team name hash for unknown teams
  let hash = 0
  for (let i = 0; i < team.length; i++) {
    hash = team.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = hash % 360
  return `hsl(${hue}, 70%, 50%)`
}

function FirefighterList({
  firefighters,
  selectedFirefighter,
  onSelectFirefighter,
  building,
  currentFloor,
  onFloorChange,
  showBeacons,
  onToggleBeacons,
  showHistory,
  onToggleHistory,
  teamFilter,
  onTeamFilterChange
}) {
  return (
    <div className="firefighter-list">
      <div className="list-header p-3 border-bottom">
        <h5 className="mb-3">Strażacy</h5>
        
        {building && (
          <div className="mb-3">
            <label className="form-label small">Piętro:</label>
            <select
              className="form-select form-select-sm"
              value={currentFloor}
              onChange={(e) => onFloorChange(parseInt(e.target.value))}
            >
              {building.floors.map((floor) => (
                <option key={floor.index} value={floor.index}>
                  {floor.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Team Filter */}
        <div className="mb-3">
          <label className="form-label small">Zespół:</label>
          <select
            className="form-select form-select-sm"
            value={teamFilter || 'all'}
            onChange={(e) => onTeamFilterChange && onTeamFilterChange(e.target.value)}
          >
            <option value="all">Wszystkie zespoły</option>
            <option value="none">Bez zespołu</option>
            {[...new Set(firefighters.map(ff => ff.team).filter(t => t && t.trim()))].sort().map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>

        <div className="d-flex gap-2">
          <button
            className={`btn btn-sm ${showBeacons ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={onToggleBeacons}
          >
            Beacony
          </button>
          <button
            className={`btn btn-sm ${showHistory ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={onToggleHistory}
          >
            Historia
          </button>
        </div>
      </div>

      <div className="list-items">
        {(() => {
          const filtered = firefighters.filter(ff => {
            // Only show firefighters who are on mission
            // Use strict check to handle undefined/null/0/false
            if (ff.on_mission !== true) {
              return false
            }
            
            // Filter by team
            if (teamFilter === 'all') return true
            if (teamFilter === 'none') return !ff.team || !ff.team.trim()
            return ff.team === teamFilter
          })
          
          // Debug logging
          console.log('FirefighterList:', {
            total: firefighters.length,
            onMission: firefighters.filter(ff => ff.on_mission === true).length,
            notOnMission: firefighters.filter(ff => ff.on_mission !== true).length,
            filtered: filtered.length,
            teamFilter
          })
          
          return filtered.map((ff) => {
          const isSelected = selectedFirefighter === ff.id
          const vitals = ff.vitals
          const position = ff.position
          const isOnCurrentFloor = position && position.floor === currentFloor

          return (
            <div
              key={ff.id}
              className={`list-item p-3 border-bottom cursor-pointer ${
                isSelected ? 'bg-primary text-white' : ''
              } ${!isOnCurrentFloor ? 'opacity-50' : ''}`}
              onClick={() => onSelectFirefighter(ff.id)}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="fw-bold">
                    {ff.name}
                    {ff.team && (
                      <span 
                        className="badge ms-2" 
                        style={{ 
                          backgroundColor: getTeamColor(ff.team),
                          color: 'white'
                        }}
                      >
                        {ff.team}
                      </span>
                    )}
                  </div>
                  <div className="small">{ff.badge_number}</div>
                </div>
                {vitals && (
                  <div className="text-end">
                    <div className="fw-bold">{vitals.heart_rate} BPM</div>
                    <div className="small">
                      {vitals.battery_level?.toFixed(0)}% 🔋
                    </div>
                  </div>
                )}
              </div>
              {position && (
                <div className="small mt-2">
                  Piętro: {position.floor} | {new Date(position.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          )
        })})()}
      </div>
    </div>
  )
}

export default FirefighterList

