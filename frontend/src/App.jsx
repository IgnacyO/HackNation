import React, { useState, useEffect } from 'react'
import Map from './components/Map'
import FirefighterList from './components/FirefighterList'
import Alerts from './components/Alerts'
import HeartRateChart from './components/HeartRateChart'
import FirefighterDetail from './components/FirefighterDetail'
import BeaconDetail from './components/BeaconDetail'
import AlertsView from './components/AlertsView'
import FirefightersView from './components/FirefightersView'
import BeaconsView from './components/BeaconsView'
import BlackBoxView from './components/BlackBoxView'
import TeamsView from './components/TeamsView'
import Navigation from './components/Navigation'
import RFIDScanner from './components/RFIDScanner'
import { api } from './utils/api'
import './App.css'

const VIEWS = {
  MAP: 'map',
  ALERTS: 'alerts',
  FIREFIGHTERS: 'firefighters',
  BEACONS: 'beacons',
  BASE: 'base',
  BLACKBOX: 'blackbox',
  TEAMS: 'teams'
}

const ALERT_TYPES = {
  'man_down': { severity: 'critical', description: 'Bezruch >30s' },
  'sos_pressed': { severity: 'critical', description: 'Przycisk SOS' },
  'high_heart_rate': { severity: 'warning', description: 'Tętno >180 bpm' },
  'low_battery': { severity: 'warning', description: 'Bateria <20%' },
  'scba_low_pressure': { severity: 'warning', description: 'Niskie ciśnienie SCBA' },
  'scba_critical': { severity: 'critical', description: 'Krytyczne ciśnienie SCBA' },
  'beacon_offline': { severity: 'warning', description: 'Beacon nie odpowiada' },
  'tag_offline': { severity: 'critical', description: 'Tag strażaka offline' },
  'high_co': { severity: 'critical', description: 'Wysokie CO' },
  'low_oxygen': { severity: 'critical', description: 'Niski O2' },
  'explosive_gas': { severity: 'critical', description: 'Gaz wybuchowy (LEL)' },
  'high_temperature': { severity: 'warning', description: 'Wysoka temperatura' },
};

function App() {
  const [currentView, setCurrentView] = useState(VIEWS.MAP)
  const [firefighters, setFirefighters] = useState([])
  const [alerts, setAlerts] = useState([])
  const [selectedFirefighter, setSelectedFirefighter] = useState(null)
  const [selectedBeacon, setSelectedBeacon] = useState(null)
  const [building, setBuilding] = useState(null)
  const [currentFloor, setCurrentFloor] = useState(0)
  const [showBeacons, setShowBeacons] = useState(true)
  const [showHistory, setShowHistory] = useState(true)
  const [teamFilter, setTeamFilter] = useState('all')

  useEffect(() => {
    // Load building info
    api.getBuilding().then(setBuilding).catch(console.error)

    // Load initial data
    loadData()

    // Set up refresh interval (1.5 seconds)
    const interval = setInterval(loadData, 1500)

    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [firefightersData, alertsData] = await Promise.all([
        api.getFirefighters(),
        api.getAlerts()
      ])
      setFirefighters(firefightersData)
      setAlerts(alertsData)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleSelectFirefighter = (firefighterId) => {
    setSelectedFirefighter(firefighterId)
    // Switch to firefighter's floor
    const ff = firefighters.find(f => f.id === firefighterId)
    if (ff && ff.position) {
      setCurrentFloor(ff.position.floor)
    }
  }

  const handleFloorChange = (floorIndex) => {
    setCurrentFloor(floorIndex)
  }

  const handleViewChange = (view) => {
    setCurrentView(view)
    if (view === VIEWS.MAP) {
      setSelectedFirefighter(null)
      setSelectedBeacon(null)
    }
  }

  const handleFirefighterClick = (firefighterId) => {
    setSelectedFirefighter(firefighterId)
    setCurrentView(VIEWS.MAP)
    const ff = firefighters.find(f => f.id === firefighterId)
    if (ff && ff.position) {
      setCurrentFloor(ff.position.floor)
    }
  }

  const renderView = () => {
    switch (currentView) {
      case VIEWS.MAP:
        return (
          <>
            <div className="sidebar">
              <FirefighterList
                firefighters={firefighters}
                selectedFirefighter={selectedFirefighter}
                onSelectFirefighter={handleSelectFirefighter}
                building={building}
                currentFloor={currentFloor}
                onFloorChange={handleFloorChange}
                showBeacons={showBeacons}
                onToggleBeacons={() => setShowBeacons(!showBeacons)}
                showHistory={showHistory}
                onToggleHistory={() => setShowHistory(!showHistory)}
                teamFilter={teamFilter}
                onTeamFilterChange={setTeamFilter}
              />
            </div>
            <div className="map-container">
              <RFIDScanner onScanSuccess={() => {
                // Refresh firefighters list after successful scan
                loadData()
              }} />
              {selectedFirefighter ? (
                <FirefighterDetail
                  firefighterId={selectedFirefighter}
                  onClose={() => setSelectedFirefighter(null)}
                />
              ) : null}
              {selectedBeacon ? (
                <BeaconDetail
                  beaconId={selectedBeacon}
                  onClose={() => setSelectedBeacon(null)}
                />
              ) : null}
              <Map
                firefighters={firefighters}
                selectedFirefighter={selectedFirefighter}
                building={building}
                currentFloor={currentFloor}
                showBeacons={showBeacons}
                showHistory={showHistory}
                onBeaconClick={setSelectedBeacon}
                teamFilter={teamFilter}
              />
              {selectedFirefighter && (
                <HeartRateChart firefighterId={selectedFirefighter} />
              )}
            </div>
          </>
        )
      case VIEWS.ALERTS:
        return <AlertsView alertTypes={ALERT_TYPES} onFirefighterClick={handleFirefighterClick} />
      case VIEWS.FIREFIGHTERS:
        return <FirefightersView onFirefighterClick={handleFirefighterClick} />
      case VIEWS.BEACONS:
        return selectedBeacon ? (
          <BeaconDetail beaconId={selectedBeacon} onClose={() => setSelectedBeacon(null)} />
        ) : (
          <BeaconsView onBeaconClick={(beaconId) => {
            setSelectedBeacon(beaconId)
            setCurrentView(VIEWS.MAP)
          }} />
        )
      case VIEWS.BASE:
      case VIEWS.BLACKBOX:
        return <BlackBoxView />
      case VIEWS.TEAMS:
        return <TeamsView onFirefighterClick={handleFirefighterClick} />
      default:
        return null
    }
  }

  return (
    <div className="app-container">
      <Alerts alerts={alerts} alertTypes={ALERT_TYPES} firefighters={firefighters} />
      <Navigation currentView={currentView} onViewChange={handleViewChange} />
      <div className="main-content">
        {renderView()}
      </div>
    </div>
  )
}

export default App

