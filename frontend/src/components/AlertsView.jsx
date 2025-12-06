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
      'man_down': '🚨',
      'sos_pressed': '🆘',
      'scba_low_pressure': '💨',
      'scba_critical': '⚠️💨',
      'low_battery': '🔋',
      'high_heart_rate': '❤️',
      'beacon_offline': '📡',
      'tag_offline': '📱',
      'high_co': '☠️',
      'low_oxygen': '🫁',
      'explosive_gas': '💥',
      'high_temperature': '🌡️'
    }
    return {
      icon: icons[alertType] || '⚠️',
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
          <h4>Aktywne alerty ({sortedAlerts.length})</h4>
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
                className={`list-group-item list-group-item-${display.color} border-${display.color === 'danger' ? 'danger' : 'warning'} border-2 ${alert.firefighter_id && onFirefighterClick ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (alert.firefighter_id && onFirefighterClick) {
                    onFirefighterClick(alert.firefighter_id)
                  }
                }}
                style={alert.firefighter_id && onFirefighterClick ? { cursor: 'pointer' } : {}}
                title={alert.firefighter_id && onFirefighterClick ? 'Kliknij, aby zobaczyć strażaka na mapie' : ''}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span style={{ fontSize: '1.5rem' }}>{display.icon}</span>
                      <div>
                        <strong className="text-uppercase">
                          {alert.alert_type.replace(/_/g, ' ')}
                        </strong>
                        <span className={`badge bg-${display.color} ms-2`}>
                          {alert.severity === 'critical' ? '🔴 KRYTYCZNY' : '🟡 OSTRZEŻENIE'}
                        </span>
                      </div>
                    </div>
                    <div className="mb-1">{alertInfo.description}</div>
                    {firefighterName ? (
                      <div className="small">
                        <strong>Strażak:</strong> {firefighterName}
                        {alert.firefighter_id && <span className="text-muted"> (ID: {alert.firefighter_id})</span>}
                        {alert.firefighter_id && onFirefighterClick && (
                          <span className="badge bg-primary ms-2">🗺️ Kliknij, aby zobaczyć na mapie</span>
                        )}
                      </div>
                    ) : alert.firefighter_id ? (
                      <div className="small text-muted">
                        Strażak ID: {alert.firefighter_id}
                        {onFirefighterClick && (
                          <span className="badge bg-primary ms-2">🗺️ Kliknij, aby zobaczyć na mapie</span>
                        )}
                      </div>
                    ) : (
                      <div className="small text-muted">Alert systemowy</div>
                    )}
                  </div>
                  <div className="text-end ms-3">
                    <div className="small fw-bold">{formatTimeAgo(timeAgo)}</div>
                    <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
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

