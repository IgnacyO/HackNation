import React, { useState, useEffect } from 'react'
import { api } from '../utils/api'

function AlertsView({ alertTypes, onFirefighterClick }) {
  const [alerts, setAlerts] = useState([])
  const [firefighters, setFirefighters] = useState([])
  const [severityFilter, setSeverityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('timestamp')
  const [sortOrder, setSortOrder] = useState('desc') // 'asc' or 'desc'
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    loadAlerts()
    loadFirefighters()
    const interval = setInterval(() => {
      loadAlerts()
      loadFirefighters()
    }, 3000)
    return () => clearInterval(interval)
  }, [severityFilter])

  const loadAlerts = async () => {
    try {
      const data = await api.getAllAlerts(
        severityFilter !== 'all' ? severityFilter : null,
        false // Only unacknowledged (active) alerts
      )
      setAlerts(data)
    } catch (error) {
      console.error('Error loading alerts:', error)
    }
  }

  const loadFirefighters = async () => {
    try {
      const data = await api.getAllFirefighters()
      setFirefighters(data)
    } catch (error) {
      console.error('Error loading firefighters:', error)
    }
  }

  // Get firefighter name by ID
  const getFirefighterName = (firefighterId) => {
    if (!firefighterId) return null
    const ff = firefighters.find(f => f.id === firefighterId)
    return ff ? ff.name : null
  }

  // Get alert icon and color
  const getAlertDisplay = (alertType, severity) => {
    const icons = {
      'man_down': 'bi-exclamation-triangle-fill',
      'sos_pressed': 'bi-exclamation-circle-fill',
      'scba_low_pressure': 'bi-wind',
      'scba_critical': 'bi-exclamation-triangle-fill',
      'low_battery': 'bi-battery-half',
      'high_heart_rate': 'bi-heart-pulse-fill',
      'beacon_offline': 'bi-broadcast',
      'tag_offline': 'bi-phone',
      'high_co': 'bi-shield-exclamation',
      'low_oxygen': 'bi-droplet-half',
      'explosive_gas': 'bi-fire',
      'high_temperature': 'bi-thermometer-half'
    }
    return {
      icon: icons[alertType] || 'bi-exclamation-circle',
      color: severity === 'critical' ? 'danger' : 'warning'
    }
  }

  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sortBy === 'severity') {
      // Sort by priority (severity)
      const severityOrder = { 'critical': 0, 'warning': 1 }
      const severityDiff = (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2)
      if (severityDiff !== 0) {
        return sortOrder === 'asc' ? severityDiff : -severityDiff
      }
      // If same severity, sort by timestamp (newest first)
      const timeDiff = new Date(b.timestamp) - new Date(a.timestamp)
      return sortOrder === 'asc' ? -timeDiff : timeDiff
    } else {
      // Sort by timestamp
      const timeDiff = new Date(b.timestamp) - new Date(a.timestamp)
      return sortOrder === 'asc' ? -timeDiff : timeDiff
    }
  })

  // Pagination
  const totalPages = Math.ceil(sortedAlerts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedAlerts = sortedAlerts.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo(0, 0)
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [severityFilter, sortBy, sortOrder])

  return (
    <div className="alerts-view p-4">
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h4 style={{ 
            color: '#f5f5f5',
            fontWeight: 'bold',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <i className="bi-bell-fill" style={{ color: '#c82333' }}></i>
            Aktywne alerty ({sortedAlerts.length})
          </h4>
        </div>
        <div className="row g-2">
          <div className="col-md-3">
            <select
              className="form-select form-select-sm"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">Wszystkie priorytety</option>
              <option value="critical">🔴 Krytyczne</option>
              <option value="warning">🟡 Ostrzeżenia</option>
            </select>
          </div>
          <div className="col-md-3">
            <select
              className="form-select form-select-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="timestamp">Sortuj po czasie</option>
              <option value="severity">Sortuj po priorytecie</option>
            </select>
          </div>
          <div className="col-md-3">
            <select
              className="form-select form-select-sm"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="desc">Najnowsze/Najwyższe</option>
              <option value="asc">Najstarsze/Najniższe</option>
            </select>
          </div>
        </div>
      </div>
      <div className="list-group">
        {paginatedAlerts.length === 0 ? (
          <div className="list-group-item text-muted">Brak alertów</div>
        ) : (
          paginatedAlerts.map((alert) => {
            const alertInfo = alertTypes[alert.alert_type] || { severity: 'warning', description: alert.message }
            const display = getAlertDisplay(alert.alert_type, alert.severity)
            const firefighterName = getFirefighterName(alert.firefighter_id)
            const alertTime = new Date(alert.timestamp)
            const timeAgo = Math.floor((Date.now() - alertTime.getTime()) / 1000)
            
            const formatTimeAgo = (seconds) => {
              if (seconds < 60) return `${seconds}s temu`
              if (seconds < 3600) return `${Math.floor(seconds / 60)}min temu`
              return `${Math.floor(seconds / 3600)}h temu`
            }
            
            return (
              <div
                key={alert.id}
                className={`list-group-item border-2 ${alert.firefighter_id && onFirefighterClick ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (alert.firefighter_id && onFirefighterClick) {
                    onFirefighterClick(alert.firefighter_id)
                  }
                }}
                style={{
                  cursor: alert.firefighter_id && onFirefighterClick ? 'pointer' : 'default',
                  background: display.color === 'danger' 
                    ? 'linear-gradient(135deg, rgba(200, 35, 51, 0.2) 0%, rgba(200, 35, 51, 0.1) 100%)'
                    : 'linear-gradient(135deg, rgba(255, 193, 7, 0.2) 0%, rgba(255, 193, 7, 0.1) 100%)',
                  borderColor: display.color === 'danger' ? '#c82333' : '#ffc107',
                  borderLeftWidth: '4px',
                  borderRadius: '8px',
                  marginBottom: '0.5rem',
                  transition: 'all 0.3s ease',
                  animation: 'fadeIn 0.4s ease-out',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  color: '#f5f5f5'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(5px) scale(1.02)'
                  e.currentTarget.style.boxShadow = display.color === 'danger'
                    ? '0 4px 16px rgba(220, 53, 69, 0.4)'
                    : '0 4px 16px rgba(255, 193, 7, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0) scale(1)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
                title={alert.firefighter_id && onFirefighterClick ? 'Kliknij, aby zobaczyć strażaka na mapie' : ''}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className={display.icon} style={{ 
                        fontSize: '1.5rem',
                        color: display.color === 'danger' ? '#c82333' : '#ffc107'
                      }}></i>
                      <div>
                        <strong className="text-uppercase" style={{ color: '#f5f5f5' }}>
                          {alert.alert_type.replace(/_/g, ' ')}
                        </strong>
                        <span 
                          className="badge ms-2"
                          style={{
                            background: display.color === 'danger'
                              ? 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)'
                              : 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
                            color: 'white',
                            padding: '0.4em 0.8em',
                            borderRadius: '4px',
                            fontWeight: '600',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}
                        >
                          {alert.severity === 'critical' ? 'KRYTYCZNY' : 'OSTRZEŻENIE'}
                        </span>
                      </div>
                    </div>
                    <div className="mb-1" style={{ color: '#d0d0d0' }}>{alertInfo.description}</div>
                    {firefighterName ? (
                      <div className="small" style={{ color: '#d0d0d0' }}>
                        <strong style={{ color: '#f5f5f5' }}>Strażak:</strong> {firefighterName}
                        {onFirefighterClick && (
                          <span 
                            className="badge ms-2"
                            style={{
                              background: 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)',
                              color: 'white',
                              padding: '0.3em 0.6em',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.transform = 'scale(1.1)'
                              e.target.style.boxShadow = '0 2px 8px rgba(200, 35, 51, 0.5)'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.transform = 'scale(1)'
                              e.target.style.boxShadow = 'none'
                            }}
                          >
                            <i className="bi-map"></i> Kliknij, aby zobaczyć na mapie
                          </span>
                        )}
                      </div>
                    ) : alert.firefighter_id ? (
                      <div className="small" style={{ color: '#999999' }}>
                        Strażak (ID: {alert.firefighter_id})
                        {onFirefighterClick && (
                          <span 
                            className="badge ms-2"
                            style={{
                              background: 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)',
                              color: 'white',
                              padding: '0.3em 0.6em',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.transform = 'scale(1.1)'
                              e.target.style.boxShadow = '0 2px 8px rgba(200, 35, 51, 0.5)'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.transform = 'scale(1)'
                              e.target.style.boxShadow = 'none'
                            }}
                          >
                            <i className="bi-map"></i> Kliknij, aby zobaczyć na mapie
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="small" style={{ color: '#999999' }}>Alert systemowy</div>
                    )}
                  </div>
                  <div className="text-end ms-3">
                    <div className="small fw-bold" style={{ color: '#f5f5f5' }}>{formatTimeAgo(timeAgo)}</div>
                    <div className="small" style={{ fontSize: '0.75rem', color: '#999999' }}>
                      {alertTime.toLocaleString('pl-PL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
      {totalPages > 1 && (
        <nav className="mt-3">
          <ul className="pagination pagination-sm justify-content-center">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                Poprzednia
              </button>
            </li>
            {[...Array(totalPages)].map((_, i) => {
              const page = i + 1
              if (page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2)) {
                return (
                  <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => handlePageChange(page)}>
                      {page}
                    </button>
                  </li>
                )
              } else if (page === currentPage - 3 || page === currentPage + 3) {
                return (
                  <li key={page} className="page-item disabled">
                    <span className="page-link">...</span>
                  </li>
                )
              }
              return null
            })}
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                Następna
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}

export default AlertsView

