import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, ImageOverlay, Marker, Popup, CircleMarker, Circle, useMap } from 'react-leaflet'
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
    'RIT': '#fd7e14',      // Orange (changed from red)
    'Engine 1': '#0d6efd', // Blue
    'Engine 2': '#198754', // Green
    'Engine 3': '#ffc107', // Yellow
    'Ladder 1': '#e67e22', // Dark Orange
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
  
  // Generate color from team name hash for unknown teams (avoiding red)
  let hash = 0
  for (let i = 0; i < team.length; i++) {
    hash = team.charCodeAt(i) + ((hash << 5) - hash)
  }
  // Avoid red hues (0-20 and 340-360) - use range 20-340 instead
  const hue = 20 + (hash % 320)
  return `hsl(${hue}, 70%, 50%)`
}

// Custom firefighter icon with better visibility
const createFirefighterIcon = (color = 'blue', team = null, isSelected = false) => {
  const teamColor = team ? getTeamColor(team) : color
  const size = isSelected ? 22 : 18
  const className = isSelected ? 'firefighter-marker firefighter-marker-selected' : 'firefighter-marker'
  const borderWidth = isSelected ? 3 : 2
  
  return L.divIcon({
    className: className,
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${teamColor};
      opacity: 0.85;
      border: ${borderWidth}px solid ${teamColor};
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Custom beacon icon - square
const createBeaconIcon = (isOnline = true) => {
  const color = isOnline ? '#4ade80' : '#6c757d' // Gray for offline
  
  return L.divIcon({
    className: 'beacon-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      border-radius: 2px;
      background-color: ${color};
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

// Component to update map view
function MapUpdater({ building, currentFloor }) {
  const map = useMap()
  const hasInitialized = useRef(false)
  
  useEffect(() => {
    if (building && !hasInitialized.current) {
      map.setView([building.center.latitude, building.center.longitude], 18)
      hasInitialized.current = true
    }
  }, [building, map])

  return null
}

// Custom Canvas layer for rotated image overlay
function RotatedImageLayer({ imageUrl, bounds, rotation }) {
  const map = useMap()
  const layerRef = useRef(null)
  const imageRef = useRef(null)
  const optionsRef = useRef({ bounds, rotation })
  
  // Update options when they change
  useEffect(() => {
    optionsRef.current = { bounds, rotation }
    if (layerRef.current && layerRef.current._update) {
      layerRef.current._update()
    }
  }, [bounds, rotation])
  
  useEffect(() => {
    if (!map || !imageUrl || !bounds) return
    
    // Load image
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      imageRef.current = img
      
      // Create custom canvas layer
      const RotatedImageOverlay = L.Layer.extend({
        onAdd: function(map) {
          this._map = map
          this._canvas = L.DomUtil.create('canvas', 'leaflet-image-layer')
          this._ctx = this._canvas.getContext('2d')
          
          const pane = map.getPane('overlayPane')
          // Set lower z-index for overlayPane to ensure controls are above
          pane.style.zIndex = '100'
          pane.appendChild(this._canvas)
          
          this._update()
          map.on('viewreset moveend zoomend', this._update, this)
        },
        
        onRemove: function(map) {
          if (this._canvas && this._canvas.parentNode) {
            map.getPanes().overlayPane.removeChild(this._canvas)
          }
          map.off('viewreset moveend zoomend', this._update, this)
          this._map = null
        },
        
        _update: function() {
          if (!this._map || !imageRef.current) return
          
          // Get current options
          const bounds = optionsRef.current.bounds
          const rotation = optionsRef.current.rotation || 0
          
          if (!bounds) return
          
          // Get pixel bounds
          const sw = this._map.latLngToContainerPoint(bounds[0])
          const ne = this._map.latLngToContainerPoint(bounds[1])
          
          // Calculate canvas size to fit rotated image
          const width = Math.abs(ne.x - sw.x)
          const height = Math.abs(ne.y - sw.y)
          const centerX = (sw.x + ne.x) / 2
          const centerY = (sw.y + ne.y) / 2
          
          // Calculate diagonal for rotation (add some padding)
          const diagonal = Math.sqrt(width * width + height * height) * 1.5
          
          // Set canvas size (use device pixel ratio for crisp rendering)
          const dpr = window.devicePixelRatio || 1
          this._canvas.width = diagonal * dpr
          this._canvas.height = diagonal * dpr
          this._canvas.style.width = diagonal + 'px'
          this._canvas.style.height = diagonal + 'px'
          this._canvas.style.position = 'absolute'
          this._canvas.style.left = (centerX - diagonal / 2) + 'px'
          this._canvas.style.top = (centerY - diagonal / 2) + 'px'
          this._canvas.style.pointerEvents = 'none'
          this._canvas.style.zIndex = '100'
          
          // Reset transform and scale context for device pixel ratio
          this._ctx.setTransform(1, 0, 0, 1, 0, 0)
          this._ctx.scale(dpr, dpr)
          
          // Clear canvas with white background for debugging
          this._ctx.fillStyle = 'rgba(255, 255, 255, 0)'
          this._ctx.fillRect(0, 0, diagonal, diagonal)
          this._ctx.clearRect(0, 0, diagonal, diagonal)
          
          // Translate to center
          this._ctx.save()
          this._ctx.translate(diagonal / 2, diagonal / 2)
          this._ctx.rotate((rotation * Math.PI) / 180)
          
          // Draw image centered
          try {
            this._ctx.drawImage(
              imageRef.current,
              -width / 2,
              -height / 2,
              width,
              height
            )
          } catch (error) {
            console.error('Error drawing image on canvas:', error)
          }
          
          this._ctx.restore()
        }
      })
      
      // Remove old layer if exists
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
      }
      
      // Create and add new layer
      const layer = new RotatedImageOverlay()
      layerRef.current = layer
      layer.addTo(map)
    }
    
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl)
    }
    
    img.src = imageUrl
    
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
      imageRef.current = null
    }
  }, [map, imageUrl, bounds])
  
  return null
}

// Component for map navigation controls
function MapNavigationControls({ imageBounds, setImageBounds, useCustomImage }) {
  const map = useMap()
  
  const handlePan = (direction) => {
    if (!map) return
    
    // If custom image is active, move the image bounds instead of the map
    if (useCustomImage && imageBounds && setImageBounds) {
      // Calculate offset in degrees (approximately 1 meter)
      // 1 degree latitude ≈ 111,000 meters
      // 1 degree longitude ≈ 111,000 * cos(latitude) meters
      const centerLat = (imageBounds[0][0] + imageBounds[1][0]) / 2
      const offsetMeters = 1 // Move by 1 meter
      const latOffset = offsetMeters / 111000
      const lonOffset = offsetMeters / (111000 * Math.cos(centerLat * Math.PI / 180))
      
      let newBounds = [...imageBounds]
      
      switch(direction) {
        case 'up':
          // Move image north (increase latitude)
          newBounds = [
            [imageBounds[0][0] + latOffset, imageBounds[0][1]],
            [imageBounds[1][0] + latOffset, imageBounds[1][1]]
          ]
          break
        case 'down':
          // Move image south (decrease latitude)
          newBounds = [
            [imageBounds[0][0] - latOffset, imageBounds[0][1]],
            [imageBounds[1][0] - latOffset, imageBounds[1][1]]
          ]
          break
        case 'left':
          // Move image west (decrease longitude)
          newBounds = [
            [imageBounds[0][0], imageBounds[0][1] - lonOffset],
            [imageBounds[1][0], imageBounds[1][1] - lonOffset]
          ]
          break
        case 'right':
          // Move image east (increase longitude)
          newBounds = [
            [imageBounds[0][0], imageBounds[0][1] + lonOffset],
            [imageBounds[1][0], imageBounds[1][1] + lonOffset]
          ]
          break
      }
      
      setImageBounds(newBounds)
    } else {
      // If no custom image, pan the map normally
      const panDistance = 100
      
      switch(direction) {
        case 'up':
          map.panBy([0, -panDistance])
          break
        case 'down':
          map.panBy([0, panDistance])
          break
        case 'left':
          map.panBy([-panDistance, 0])
          break
        case 'right':
          map.panBy([panDistance, 0])
          break
      }
    }
  }
  
  const handleZoom = (direction) => {
    if (!map) return
    
    if (direction === 'in') {
      map.zoomIn()
    } else {
      map.zoomOut()
    }
  }
  
  const buttonStyle = {
    padding: '8px',
    background: 'transparent',
    color: '#d0d0d0',
    border: '1px solid #c82333',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  const zoomButtonStyle = {
    ...buttonStyle,
    padding: '4px 8px',
    fontSize: '14px'
  }

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      zIndex: 1001,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
      padding: '10px',
      borderRadius: '8px',
      border: '2px solid #c82333',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 44px)',
      gridTemplateRows: 'repeat(3, 44px)',
      gap: '6px',
      width: 'auto',
      height: 'auto'
    }}>
      {/* Row 1: Up arrow */}
      <div style={{ gridColumn: '1', gridRow: '1' }}></div>
      <button
        onClick={() => handlePan('up')}
        style={{ ...buttonStyle, gridColumn: '2', gridRow: '1' }}
        onMouseEnter={(e) => {
          e.target.style.color = '#c82333'
          e.target.style.background = 'rgba(200, 35, 51, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.target.style.color = '#d0d0d0'
          e.target.style.background = 'transparent'
        }}
        title="Przesuń w górę"
      >
        <i className="bi bi-arrow-up"></i>
      </button>
      <div style={{ gridColumn: '3', gridRow: '1' }}></div>
      
      {/* Row 2: Left, Zoom controls, Right */}
      <button
        onClick={() => handlePan('left')}
        style={{ ...buttonStyle, gridColumn: '1', gridRow: '2' }}
        onMouseEnter={(e) => {
          e.target.style.color = '#c82333'
          e.target.style.background = 'rgba(200, 35, 51, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.target.style.color = '#d0d0d0'
          e.target.style.background = 'transparent'
        }}
        title="Przesuń w lewo"
      >
        <i className="bi bi-arrow-left"></i>
      </button>
      <div style={{ 
        gridColumn: '2', 
        gridRow: '2',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '6px',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2px 0'
      }}>
        <button
          onClick={() => handleZoom('in')}
          style={{ ...zoomButtonStyle, minHeight: '18px', padding: '2px 8px' }}
          onMouseEnter={(e) => {
            e.target.style.color = '#c82333'
            e.target.style.background = 'rgba(200, 35, 51, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.target.style.color = '#d0d0d0'
            e.target.style.background = 'transparent'
          }}
          title="Przybliż"
        >
          <i className="bi bi-plus-lg"></i>
        </button>
        <button
          onClick={() => handleZoom('out')}
          style={{ ...zoomButtonStyle, minHeight: '18px', padding: '2px 8px' }}
          onMouseEnter={(e) => {
            e.target.style.color = '#c82333'
            e.target.style.background = 'rgba(200, 35, 51, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.target.style.color = '#d0d0d0'
            e.target.style.background = 'transparent'
          }}
          title="Oddal"
        >
          <i className="bi bi-dash-lg"></i>
        </button>
      </div>
      <button
        onClick={() => handlePan('right')}
        style={{ ...buttonStyle, gridColumn: '3', gridRow: '2' }}
        onMouseEnter={(e) => {
          e.target.style.color = '#c82333'
          e.target.style.background = 'rgba(200, 35, 51, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.target.style.color = '#d0d0d0'
          e.target.style.background = 'transparent'
        }}
        title="Przesuń w prawo"
      >
        <i className="bi bi-arrow-right"></i>
      </button>
      
      {/* Row 3: Down arrow */}
      <div style={{ gridColumn: '1', gridRow: '3' }}></div>
      <button
        onClick={() => handlePan('down')}
        style={{ ...buttonStyle, gridColumn: '2', gridRow: '3' }}
        onMouseEnter={(e) => {
          e.target.style.color = '#c82333'
          e.target.style.background = 'rgba(200, 35, 51, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.target.style.color = '#d0d0d0'
          e.target.style.background = 'transparent'
        }}
        title="Przesuń w dół"
      >
        <i className="bi bi-arrow-down"></i>
      </button>
      <div style={{ gridColumn: '3', gridRow: '3' }}></div>
    </div>
  )
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
  const [customImageUrl, setCustomImageUrl] = useState(null)
  const [imageBounds, setImageBounds] = useState(null)
  const [useCustomImage, setUseCustomImage] = useState(false)
  const [rotation, setRotation] = useState(0)
  const fileInputRef = useRef(null)

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

  // Handle image upload
  const handleImageUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Proszę wybrać plik obrazu (PNG, JPG, itp.)')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageUrl = e.target?.result
      if (!imageUrl) return

      // Create image to get dimensions
      const img = new Image()
      img.onload = () => {
        setCustomImageUrl(imageUrl)
        
        // Use building center and calculate bounds based on building dimensions
        // This ensures the image is properly georeferenced
        if (building && building.center) {
          const centerLat = building.center.latitude
          const centerLon = building.center.longitude
          
          // Calculate bounds based on building dimensions if available
          if (building.dimensions) {
            const { width, height } = building.dimensions
            // Convert meters to degrees: 1 degree lat ≈ 111km, 1 degree lon ≈ 111km * cos(lat)
            const latOffset = (height / 2) / 111000
            const lonOffset = (width / 2) / (111000 * Math.cos(centerLat * Math.PI / 180))
            
            const bounds = [
              [centerLat - latOffset, centerLon - lonOffset], // Southwest
              [centerLat + latOffset, centerLon + lonOffset]  // Northeast
            ]
            setImageBounds(bounds)
          } else {
            // Fallback: use a reasonable default area around building center
            // ~50m x 50m area (0.00045 degrees ≈ 50m)
            const defaultOffset = 0.00045
            const bounds = [
              [centerLat - defaultOffset, centerLon - defaultOffset], // Southwest
              [centerLat + defaultOffset, centerLon + defaultOffset]  // Northeast
            ]
            setImageBounds(bounds)
          }
          setUseCustomImage(true)
        } else {
          alert('Brak informacji o budynku. Nie można ustawić obrazu.')
        }
      }
      img.src = imageUrl
    }
    reader.readAsDataURL(file)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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
    <div style={{ position: 'relative', height: '100%', width: '100%', zIndex: 1 }}>
      {/* Rotation controls - only show when image is loaded */}
      {useCustomImage && customImageUrl && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1001,
          background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
          padding: '12px',
          borderRadius: '8px',
          border: '2px solid #c82333',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minWidth: '120px'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#d0d0d0',
            marginBottom: '4px',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            Obrót obrazu
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <button
              onClick={() => setRotation(prev => prev - 15)}
              style={{
                padding: '8px 12px',
                background: 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                flex: '1'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 4px 8px rgba(200, 35, 51, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = 'none'
              }}
              title="Obróć w lewo o 15°"
            >
              <i className="bi bi-arrow-counterclockwise"></i>
            </button>
            <div style={{
              padding: '8px 12px',
              background: '#252525',
              color: '#f5f5f5',
              border: '1px solid #333333',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              textAlign: 'center',
              minWidth: '50px'
            }}>
              {rotation}°
            </div>
            <button
              onClick={() => setRotation(prev => prev + 15)}
              style={{
                padding: '8px 12px',
                background: 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                flex: '1'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 4px 8px rgba(200, 35, 51, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = 'none'
              }}
              title="Obróć w prawo o 15°"
            >
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
          <button
            onClick={() => setRotation(0)}
            style={{
              padding: '6px',
              background: 'transparent',
              color: '#d0d0d0',
              border: '1px solid #333333',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.color = '#c82333'
              e.target.style.borderColor = '#c82333'
              e.target.style.background = 'rgba(200, 35, 51, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.target.style.color = '#d0d0d0'
              e.target.style.borderColor = '#333333'
              e.target.style.background = 'transparent'
            }}
            title="Resetuj obrót"
          >
            Resetuj
          </button>
        </div>
      )}

      {/* Image upload controls */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        zIndex: 1001,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)',
        padding: '10px',
        borderRadius: '6px',
        border: '1px solid #c82333',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
          id="image-upload-input"
        />
        <label
          htmlFor="image-upload-input"
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            background: 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)',
            color: 'white',
            borderRadius: '4px',
            textAlign: 'center',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontWeight: '500',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)'
            e.target.style.boxShadow = '0 4px 8px rgba(200, 35, 51, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = 'none'
          }}
        >
          <i className="bi bi-map"></i>
          Wgraj obraz PNG
        </label>
        {useCustomImage && (
          <>
            <button
              onClick={() => setUseCustomImage(!useCustomImage)}
              style={{
                padding: '8px 12px',
                background: useCustomImage 
                  ? 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)'
                  : 'transparent',
                color: useCustomImage ? 'white' : '#d0d0d0',
                border: '1px solid #c82333',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: useCustomImage ? 'bold' : 'normal',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                if (!useCustomImage) {
                  e.target.style.color = '#c82333'
                }
              }}
              onMouseLeave={(e) => {
                if (!useCustomImage) {
                  e.target.style.color = '#d0d0d0'
                }
              }}
            >
              {useCustomImage ? 'Obraz włączony' : 'Mapa włączona'}
            </button>
            <button
              onClick={() => {
                setCustomImageUrl(null)
                setImageBounds(null)
                setUseCustomImage(false)
              }}
              style={{
                padding: '8px 12px',
                background: 'transparent',
                color: '#d0d0d0',
                border: '1px solid #c82333',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.color = '#c82333'
                e.target.style.background = 'rgba(200, 35, 51, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#d0d0d0'
                e.target.style.background = 'transparent'
              }}
            >
              Usuń obraz
            </button>
          </>
        )}
      </div>

      <MapContainer
        center={center}
        zoom={18}
        minZoom={1}
        maxZoom={25}
        doubleClickZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        {/* Always show tile layer as background */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={25}
          minZoom={1}
          opacity={useCustomImage ? 0.3 : 1}
        />
        
        {/* Show custom rotated image overlay */}
        {useCustomImage && customImageUrl && imageBounds && (
          <RotatedImageLayer
            imageUrl={customImageUrl}
            bounds={imageBounds}
            rotation={rotation}
          />
        )}
        
        <MapUpdater building={building} currentFloor={currentFloor} />
        <MapNavigationControls 
          imageBounds={imageBounds}
          setImageBounds={setImageBounds}
          useCustomImage={useCustomImage}
        />

      {/* Firefighters */}
      {visibleFirefighters.map((ff) => {
        if (!ff.position) {
          console.log('Firefighter without position (filtered out):', ff.id, ff.name, ff.team)
          return null
        }
        
        const isSelected = selectedFirefighter === ff.id
        const teamColor = getTeamColor(ff.team)
        
        return (
          <Marker
            key={`${ff.id}-${isSelected ? 'selected' : 'normal'}`}
            position={[ff.position.latitude, ff.position.longitude]}
            icon={createFirefighterIcon(teamColor, ff.team, isSelected)}
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
              color: beacon.is_online ? 'rgba(74, 222, 128, 0.4)' : 'rgba(108, 117, 125, 0.4)',
              fillColor: beacon.is_online ? 'rgba(74, 222, 128, 0.15)' : 'rgba(108, 117, 125, 0.15)',
              fillOpacity: 0.3,
              weight: 2
            }}
            eventHandlers={{
              click: () => onBeaconClick && onBeaconClick(beacon.id)
            }}
          />
          {/* Beacon marker */}
          <Marker
            position={[beacon.latitude, beacon.longitude]}
            icon={createBeaconIcon(beacon.is_online)}
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
          </Marker>
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
      
      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
        padding: '12px 20px',
        borderRadius: '8px',
        border: '2px solid #c82333',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
        flexWrap: 'wrap',
        maxWidth: '90%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#0d6efd',
            border: '2px solid #0d6efd',
            opacity: 0.85
          }}></div>
          <span style={{ color: '#f5f5f5', fontSize: '13px', fontWeight: '500' }}>Strażak</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(255, 215, 0, 0.3)',
            border: '3px solid rgba(255, 215, 0, 0.8)',
            boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
          }}></div>
          <span style={{ color: '#f5f5f5', fontSize: '13px', fontWeight: '500' }}>Zaznaczony</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            background: '#ffc107',
            border: 'none'
          }}></div>
          <span style={{ color: '#f5f5f5', fontSize: '13px', fontWeight: '500' }}>Beacon</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'transparent',
            border: '2px solid #c82333'
          }}></div>
          <span style={{ color: '#f5f5f5', fontSize: '13px', fontWeight: '500' }}>Zasięg 50m</span>
        </div>
      </div>
    </div>
  )
}

export default Map

