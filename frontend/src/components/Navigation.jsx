import React from 'react'

function Navigation({ currentView, onViewChange }) {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <span className="navbar-brand">Locero</span>
        <div className="navbar-nav">
          <button
            className={`nav-link btn btn-link text-white ${currentView === 'map' ? 'active fw-bold' : ''}`}
            onClick={() => onViewChange('map')}
            style={{ border: 'none', background: 'none' }}
          >
            Mapa
          </button>
          <button
            className={`nav-link btn btn-link text-white ${currentView === 'alerts' ? 'active fw-bold' : ''}`}
            onClick={() => onViewChange('alerts')}
            style={{ border: 'none', background: 'none' }}
          >
            Alerty
          </button>
          <button
            className={`nav-link btn btn-link text-white ${currentView === 'firefighters' ? 'active fw-bold' : ''}`}
            onClick={() => onViewChange('firefighters')}
            style={{ border: 'none', background: 'none' }}
          >
            Strażacy
          </button>
          <button
            className={`nav-link btn btn-link text-white ${currentView === 'beacons' ? 'active fw-bold' : ''}`}
            onClick={() => onViewChange('beacons')}
            style={{ border: 'none', background: 'none' }}
          >
            Beacony
          </button>
          <button
            className={`nav-link btn btn-link text-white ${currentView === 'base' || currentView === 'blackbox' ? 'active fw-bold' : ''}`}
            onClick={() => onViewChange('blackbox')}
            style={{ border: 'none', background: 'none' }}
          >
            📦 Czarna Skrzynka
          </button>
          <button
            className={`nav-link btn btn-link text-white ${currentView === 'teams' ? 'active fw-bold' : ''}`}
            onClick={() => onViewChange('teams')}
            style={{ border: 'none', background: 'none' }}
          >
            👥 Zespoły
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navigation

