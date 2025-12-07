import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { api } from '../utils/api'

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

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

// Custom firefighter icon with better visibility
const createFirefighterIcon = (color = 'blue', team = null) => {
  const teamColor = team ? getTeamColor(team) : color
  return L.divIcon({
    className: 'firefighter-marker',
    html: `<div style="
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: ${teamColor};
      border: 4px solid white;
      box-shadow: 0 3px 8px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.8);
    "></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

// Component to update map view
function MapUpdater({ building, currentFloor }) {
  const map = useMap()
  
  useEffect(() => {
    if (building) {
      map.setView([building.center.latitude, building.center.longitude], 18)
    }
  }, [building, map])

  return null
}

function Map({
  firefighters,
  selectedFirefighter,
  building,
  currentFloor,
  showBeacons,
  showHistory,
  onBeaconClick,
  teamFilter = 'all',
  onFirefighterClick
}) {
  const [beacons, setBeacons] = useState([])
  const [positionHistory, setPositionHistory] = useState({})
  const historyLayersRef = useRef({})

  // Load beacons
  useEffect(() => {
    if (showBeacons && building) {
      // Get all beacons, then filter by floor
      api.getBeacons(null).then(allBeacons => {
        // Filter by current floor
        const filtered = allBeacons.filter(b => b.floor === currentFloor)
        setBeacons(filtered)
      }).catch(console.error)
    } else {
      setBeacons([])
    }
  }, [showBeacons, currentFloor, building])

  // Load position history for selected firefighter
  useEffect(() => {
    if (showHistory && selectedFirefighter) {
      api.getFirefighterPositions(selectedFirefighter, 100)
        .then(positions => {
          setPositionHistory(prev => ({
            ...prev,
            [selectedFirefighter]: positions
          }))
        })
        .catch(console.error)
    }
  }, [showHistory, selectedFirefighter])

  // Filter firefighters by mission status, floor and team
  const visibleFirefighters = firefighters.filter(ff => {
    // Only show firefighters who are on mission
    if (ff.on_mission !== true) {
      return false
    }
    
    if (!ff.position) {
      if (teamFilter === 'RIT' || (teamFilter !== 'all' && teamFilter !== 'none')) {
        const ffTeam = ff.team ? ff.team.trim() : ''
        if (ffTeam.toLowerCase() === 'rit' || (teamFilter !== 'all' && teamFilter !== 'none' && ffTeam.toLowerCase() === teamFilter.toLowerCase())) {
          console.log('Firefighter filtered out (no position):', ff.id, ff.name, 'team:', ff.team, 'filter:', teamFilter)
        }
      }
      return false
    }
    if (ff.position.floor !== currentFloor) {
      if (teamFilter === 'RIT' || (teamFilter !== 'all' && teamFilter !== 'none')) {
        const ffTeam = ff.team ? ff.team.trim() : ''
        if (ffTeam.toLowerCase() === 'rit' || (teamFilter !== 'all' && teamFilter !== 'none' && ffTeam.toLowerCase() === teamFilter.toLowerCase())) {
          console.log('Firefighter filtered out (wrong floor):', ff.id, ff.name, 'team:', ff.team, 'floor:', ff.position.floor, 'current floor:', currentFloor, 'filter:', teamFilter)
        }
      }
      return false
    }
    
    // Filter by team (case-insensitive, trimmed)
    if (teamFilter !== 'all') {
      if (teamFilter === 'none') {
        return !ff.team || !ff.team.trim()
      }
      // Normalize team names for comparison (trim and case-insensitive)
      const ffTeam = ff.team ? ff.team.trim() : ''
      const filterTeam = teamFilter.trim()
      const matches = ffTeam.toLowerCase() === filterTeam.toLowerCase()
      if (teamFilter === 'RIT' && !matches) {
        console.log('RIT filter - firefighter does not match:', ff.id, ff.name, 'team:', ffTeam, 'filter:', filterTeam, 'matches:', matches)
      }
      return matches
    }
    
    return true
  })
  
  // Debug: Log filtering results
  console.log('Map filtering:', {
    total: firefighters.length,
    onMission: firefighters.filter(ff => ff.on_mission === true).length,
    notOnMission: firefighters.filter(ff => ff.on_mission !== true).length,
    visible: visibleFirefighters.length,
    currentFloor,
    teamFilter
  })
  
  // Debug: Log all RIT firefighters and why they're filtered
  if (teamFilter === 'RIT') {
    const allRIT = firefighters.filter(ff => {
      const team = ff.team ? ff.team.trim().toLowerCase() : ''
      return team === 'rit'
    })
    console.log('All RIT firefighters in Map:', allRIT.map(ff => ({
      id: ff.id,
      name: ff.name,
      team: ff.team,
      hasPosition: !!ff.position,
      floor: ff.position?.floor,
      currentFloor: currentFloor,
      matchesFloor: ff.position?.floor === currentFloor
    })))
    console.log('Visible RIT firefighters after filtering:', visibleFirefighters.map(ff => ({
      id: ff.id,
      name: ff.name,
      team: ff.team,
      floor: ff.position?.floor
    })))
  }

  if (!building) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Ładowanie...</span>
        </div>
      </div>
    )
  }

  const center = [building.center.latitude, building.center.longitude]

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={18}
        minZoom={1}
        maxZoom={25}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={25}
          minZoom={1}
        />
        
        <MapUpdater building={building} currentFloor={currentFloor} />

      {/* Firefighters */}
      {visibleFirefighters.map((ff) => {
        if (!ff.position) {
          console.log('Firefighter without position (filtered out):', ff.id, ff.name, ff.team)
          return null
        }
        
        const isSelected = selectedFirefighter === ff.id
        const teamColor = getTeamColor(ff.team)
        const iconColor = isSelected ? 'red' : teamColor
        
        return (
          <Marker
            key={ff.id}
            position={[ff.position.latitude, ff.position.longitude]}
            icon={createFirefighterIcon(iconColor, ff.team)}
            eventHandlers={{
              click: () => {
                if (onFirefighterClick) {
                  onFirefighterClick(ff.id)
                }
              }
            }}
          >
            <Popup>
              <div>
                <strong>{ff.name || 'Brak imienia'}</strong><br />
                ID: {ff.badge_number}<br />
                {ff.team && ff.team.trim() && (
                  <>
                    <span style={{ color: teamColor, fontSize: '1.2em' }}>●</span> {ff.team}<br />
                  </>
                )}
                {ff.vitals && (
                  <>
                    Tętno: {ff.vitals.heart_rate || 'N/A'} BPM<br />
                    Bateria: {ff.vitals.battery_level !== null && ff.vitals.battery_level !== undefined 
                      ? `${ff.vitals.battery_level.toFixed(0)}%` 
                      : 'N/A'}%<br />
                  </>
                )}
                {onFirefighterClick && (
                  <button
                    className="btn btn-sm btn-primary mt-2"
                    onClick={() => onFirefighterClick(ff.id)}
                  >
                    Szczegóły
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}

      {/* Position History */}
      {showHistory && selectedFirefighter && positionHistory[selectedFirefighter] && (
        <>
          {positionHistory[selectedFirefighter].map((pos, index) => {
            if (index === 0) return null // Skip current position
            
            return (
              <CircleMarker
                key={`history-${selectedFirefighter}-${index}`}
                center={[pos.latitude, pos.longitude]}
                radius={3}
                pathOptions={{
                  color: 'gray',
                  fillColor: 'gray',
                  fillOpacity: 0.6,
                  weight: 1
                }}
              />
            )
          })}
        </>
      )}

      {/* Beacons with range circles */}
      {showBeacons && beacons.map((beacon) => (
        <React.Fragment key={beacon.id}>
          {/* Range circle */}
          <Circle
            center={[beacon.latitude, beacon.longitude]}
            radius={50}
            pathOptions={{
              color: beacon.is_online ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255, 0, 0, 0.5)',
              fillColor: beacon.is_online ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 0, 0, 0.2)',
              fillOpacity: 0.3,
              weight: 2
            }}
            eventHandlers={{
              click: () => onBeaconClick && onBeaconClick(beacon.id)
            }}
          />
          {/* Beacon marker */}
          <CircleMarker
            center={[beacon.latitude, beacon.longitude]}
            radius={10}
            pathOptions={{
              color: beacon.is_online ? '#4ade80' : '#ff0000',
              fillColor: beacon.is_online ? '#4ade80' : '#ff0000',
              fillOpacity: 0.7,
              weight: 2
            }}
            eventHandlers={{
              click: () => onBeaconClick && onBeaconClick(beacon.id)
            }}
          >
            <Popup>
              <div>
                <strong>{beacon.name}</strong><br />
                ID: {beacon.beacon_id}<br />
                <span className={beacon.is_online ? 'text-success' : 'text-danger'}>
                  Status: {beacon.is_online ? '🟢 Aktywny' : '🔴 Nieaktywny'}
                </span><br />
                Bateria: {beacon.battery_percent?.toFixed(0)}%<br />
                Sygnał: {beacon.signal_quality?.toFixed(0)}%<br />
                Tagi: {beacon.tags_in_range}<br />
                Zasięg: 50m
              </div>
            </Popup>
          </CircleMarker>
        </React.Fragment>
      ))}
      </MapContainer>
      
      {/* Color overlay for better visibility */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(200, 220, 255, 0.15) 100%)',
        pointerEvents: 'none',
        zIndex: 1000,
        mixBlendMode: 'overlay'
      }} />
    </div>
  )
}

export default Map

