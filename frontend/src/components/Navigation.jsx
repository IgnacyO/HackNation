import React from 'react'

function Navigation({ currentView, onViewChange }) {
  return (
    <nav className="navbar navbar-expand-lg" style={{ 
      background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)',
      borderBottom: '2px solid #c82333',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.6)',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <div className="container-fluid">
        <span className="navbar-brand fw-bold" style={{ 
          color: '#c82333',
          fontSize: '1.5rem',
          letterSpacing: '2px'
        }}>
          LOCERO
        </span>
        <div className="navbar-nav d-flex flex-row gap-2">
          {[
            { key: 'map', label: 'Mapa', icon: 'bi-map' },
            { key: 'alerts', label: 'Alerty', icon: 'bi-bell' },
            { key: 'firefighters', label: 'Strażacy', icon: 'bi-people' },
            { key: 'beacons', label: 'Beacony', icon: 'bi-broadcast' },
            { key: 'blackbox', label: 'Czarna Skrzynka', icon: 'bi-box' },
            { key: 'teams', label: 'Zespoły', icon: 'bi-diagram-3' }
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              className={`nav-link btn btn-link ${currentView === key ? 'active' : ''}`}
              onClick={() => onViewChange(key)}
              style={{
                border: 'none',
                background: currentView === key 
                  ? 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)'
                  : 'transparent',
                color: currentView === key ? 'white' : '#d0d0d0',
                fontWeight: currentView === key ? 'bold' : 'normal',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                if (currentView !== key) {
                  e.target.style.color = '#c82333'
                  e.target.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (currentView !== key) {
                  e.target.style.color = '#d0d0d0'
                  e.target.style.transform = 'translateY(0)'
                }
              }}
            >
              <i className={icon}></i>
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default Navigation

