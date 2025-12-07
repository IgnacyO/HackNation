import React, { useState, useEffect } from 'react'
import { api } from '../utils/api'
import Map from './Map'
import FirefighterDetail from './FirefighterDetail'

// Team color mapping
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

function TeamsView({ onFirefighterClick }) {
  const [firefighters, setFirefighters] = useState([])
  const [building, setBuilding] = useState(null)
  const [currentFloor, setCurrentFloor] = useState(0)
  const [teamFilter, setTeamFilter] = useState('all')
  const [selectedFirefighter, setSelectedFirefighter] = useState(null)
  const [showBeacons, setShowBeacons] = useState(false)
  const [buildingInitialized, setBuildingInitialized] = useState(false)

  useEffect(() => {
    loadInitialData()
    const interval = setInterval(loadFirefighters, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadInitialData = async () => {
    try {
      const buildingData = await api.getBuilding()
      if (buildingData && !buildingInitialized) {
        setBuilding(buildingData)
        if (buildingData.floors && buildingData.floors.length > 0) {
          // Use the actual index from building data (can be negative for basement)
          const firstFloorIndex = buildingData.floors[0].index
          setCurrentFloor(firstFloorIndex !== undefined ? firstFloorIndex : 0)
          console.log('Initial floor set to:', firstFloorIndex, 'from building data:', buildingData.floors)
        }
        setBuildingInitialized(true)
      }
      await loadFirefighters()
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const loadFirefighters = async () => {
    try {
      const firefightersData = await api.getFirefighters()
      setFirefighters(firefightersData)
      
      // Debug: Log all RIT firefighters
      const ritFirefighters = firefightersData.filter(ff => {
        const team = ff.team ? ff.team.trim().toLowerCase() : ''
        return team === 'rit'
      })
      console.log('All RIT firefighters in TeamsView:', ritFirefighters.map(ff => ({
        id: ff.id,
        name: ff.name,
        team: ff.team,
        hasPosition: !!ff.position,
        floor: ff.position?.floor,
        position: ff.position
      })))
    } catch (error) {
      console.error('Error loading firefighters:', error)
    }
  }

  const handleSelectFirefighter = (firefighterId) => {
    setSelectedFirefighter(firefighterId)
    const ff = firefighters.find(f => f.id === firefighterId)
    if (ff && ff.position) {
      setCurrentFloor(ff.position.floor)
    }
  }

  const handleFloorChange = (floorIndex) => {
    setCurrentFloor(floorIndex)
  }

  // Group firefighters by team (normalize team names)
  const teamGroups = firefighters.reduce((acc, ff) => {
    const team = ff.team && ff.team.trim() ? ff.team.trim() : 'Bez zespołu'
    if (!acc[team]) {
      acc[team] = []
    }
    acc[team].push(ff)
    return acc
  }, {})

  const teams = Object.keys(teamGroups).sort()
  
  // Debug: Log RIT team members
  if (teamGroups['RIT']) {
    console.log('RIT team members:', teamGroups['RIT'].map(ff => ({
      id: ff.id,
      name: ff.name,
      badge: ff.badge_number,
      team: ff.team,
      hasPosition: !!ff.position,
      floor: ff.position?.floor
    })))
  }

  return (
    <div className="teams-view" style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      background: '#0f0f0f'
    }}>
      {/* Controls */}
      <div className="p-3 border-bottom" style={{ 
        flexShrink: 0, 
        width: '100%',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
        borderBottom: '2px solid #333333'
      }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h4 className="mb-0" style={{ color: '#f5f5f5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="bi-diagram-3-fill" style={{ color: '#c82333' }}></i>
            Zespoły - Widok na mapie
          </h4>
        </div>
        <div className="row g-2">
          <div className="col-md-3">
            {building && (
              <select
                className="form-select form-select-sm"
                value={currentFloor}
                onChange={(e) => handleFloorChange(parseInt(e.target.value))}
              >
                {building.floors.map((floor) => (
                  <option key={floor.index} value={floor.index}>
                    {floor.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="col-md-3">
            <select
              className="form-select form-select-sm"
              value={teamFilter}
              onChange={(e) => {
                const newFilter = e.target.value
                console.log('Team filter changed to:', newFilter, 'from select')
                setTeamFilter(newFilter)
              }}
              key={`team-filter-${teams.length}`} // Force re-render when teams change
            >
              <option value="all">Wszystkie zespoły</option>
              <option value="none">Bez zespołu</option>
              {teams.filter(t => t !== 'Bez zespołu').map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <button
              className={`btn btn-sm ${showBeacons ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setShowBeacons(!showBeacons)}
            >
              {showBeacons ? 'Ukryj beacony' : 'Pokaż beacony'}
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', width: '100%', minHeight: 0 }}>
        {building ? (
          <>
            {selectedFirefighter && (
              <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, maxWidth: '300px' }}>
                <FirefighterDetail
                  firefighterId={selectedFirefighter}
                  onClose={() => setSelectedFirefighter(null)}
                />
              </div>
            )}
            <Map
              firefighters={firefighters}
              selectedFirefighter={selectedFirefighter}
              building={building}
              currentFloor={currentFloor}
              showBeacons={showBeacons}
              showHistory={false}
              onBeaconClick={() => {}}
              teamFilter={teamFilter}
              onFirefighterClick={handleSelectFirefighter}
            />
          </>
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Ładowanie...</span>
            </div>
          </div>
        )}
      </div>

      {/* Team Legend - Scrollable */}
      <div className="border-top" style={{ 
        maxHeight: '200px', 
        overflowY: 'auto', 
        width: '100%', 
        flexShrink: 0,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
        borderTop: '2px solid #333333'
      }}>
        <div className="p-3">
          <h6 className="mb-2" style={{ color: '#f5f5f5' }}>Legenda zespołów (kliknij, aby filtrować)</h6>
          <div className="d-flex flex-wrap gap-2">
            {teams.map(team => {
              const teamFirefighters = teamGroups[team]
              const teamColor = getTeamColor(team)
              return (
                <div
                  key={team}
                  className="badge"
                  style={{
                    backgroundColor: teamColor,
                    color: 'white',
                    fontSize: '0.9rem',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => {
                    const newFilter = team === 'Bez zespołu' ? 'none' : team
                    console.log('Team filter clicked:', newFilter, 'from team:', team)
                    setTeamFilter(newFilter)
                  }}
                  title={`Kliknij, aby filtrować: ${team}`}
                >
                  {team} ({teamFirefighters.length})
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamsView

