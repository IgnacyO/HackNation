import React, { useState, useEffect } from 'react'
import { api } from '../utils/api'

function FirefightersView({ onFirefighterClick }) {
  const [firefighters, setFirefighters] = useState([])
  const [alerts, setAlerts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [missionFilter, setMissionFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [batteryFilter, setBatteryFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    loadFirefighters()
    loadAlerts()
    const interval = setInterval(() => {
      loadFirefighters()
      loadAlerts()
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadFirefighters = async () => {
    try {
      const data = await api.getAllFirefighters()
      setFirefighters(data)
    } catch (error) {
      console.error('Error loading firefighters:', error)
    }
  }

  const loadAlerts = async () => {
    try {
      const data = await api.getAllAlerts('critical', false)
      setAlerts(data)
    } catch (error) {
      console.error('Error loading alerts:', error)
    }
  }

  // Get firefighters with critical alerts
  const getFirefightersWithCriticalAlerts = () => {
    const criticalFirefighterIds = new Set(
      alerts.filter(a => a.severity === 'critical' && a.firefighter_id)
        .map(a => a.firefighter_id)
    )
    return criticalFirefighterIds
  }

  const criticalFirefighterIds = getFirefightersWithCriticalAlerts()
  
  // Get unique teams for filter
  const teams = [...new Set(firefighters.map(ff => ff.team).filter(t => t && t.trim()))].sort()
  
  const filtered = firefighters.filter(ff => {
    // Search filter (ID/badge_number and name)
    const matchesSearch = !searchTerm || 
                         ff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ff.badge_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Mission filter
    const matchesMission = missionFilter === 'all' ||
                          (missionFilter === 'on' && ff.on_mission) ||
                          (missionFilter === 'off' && !ff.on_mission)
    
    // Team filter
    const matchesTeam = teamFilter === 'all' ||
                       (teamFilter === 'none' && (!ff.team || !ff.team.trim())) ||
                       (ff.team && ff.team === teamFilter)
    
    // Status filter (mission status + critical alerts)
    const isDangerous = criticalFirefighterIds.has(ff.id)
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'dangerous' && isDangerous) ||
                         (statusFilter === 'safe' && !isDangerous)
    
    // Battery filter
    const batteryLevel = ff.vitals?.battery_level
    const matchesBattery = batteryFilter === 'all' ||
                          (batteryFilter === 'low' && batteryLevel !== null && batteryLevel < 20) ||
                          (batteryFilter === 'medium' && batteryLevel !== null && batteryLevel >= 20 && batteryLevel < 50) ||
                          (batteryFilter === 'high' && batteryLevel !== null && batteryLevel >= 50) ||
                          (batteryFilter === 'unknown' && (batteryLevel === null || batteryLevel === undefined))
    
    return matchesSearch && matchesMission && matchesTeam && matchesStatus && matchesBattery
  })

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedFirefighters = filtered.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo(0, 0)
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, missionFilter, teamFilter, statusFilter, batteryFilter])

  return (
    <div className="firefighters-view p-4">
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h4>Wszyscy strażacy ({filtered.length})</h4>
        </div>
        <div className="row g-2">
          <div className="col-md-3">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Szukaj (ID, imię)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <select
              className="form-select form-select-sm"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            >
              <option value="all">Wszystkie zespoły</option>
              <option value="none">Bez zespołu</option>
              {teams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select form-select-sm"
              value={missionFilter}
              onChange={(e) => setMissionFilter(e.target.value)}
            >
              <option value="all">Wszyscy</option>
              <option value="on">Na misji</option>
              <option value="off">Poza misją</option>
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Wszystkie statusy</option>
              <option value="dangerous">⚠️ Zagrożeni</option>
              <option value="safe">✅ Bezpieczni</option>
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select form-select-sm"
              value={batteryFilter}
              onChange={(e) => setBatteryFilter(e.target.value)}
            >
              <option value="all">Wszystkie baterie</option>
              <option value="high">🔋 Wysoka (&gt;50%)</option>
              <option value="medium">🔋 Średnia (20-50%)</option>
              <option value="low">🔋 Niska (&lt;20%)</option>
              <option value="unknown">❓ Nieznana</option>
            </select>
          </div>
        </div>
      </div>
      <div className="list-group">
        {paginatedFirefighters.length === 0 ? (
          <div className="list-group-item text-muted">Brak strażaków</div>
        ) : (
          paginatedFirefighters.map((ff) => {
            const isDangerous = criticalFirefighterIds.has(ff.id)
            return (
              <div
                key={ff.id}
                className={`list-group-item ${isDangerous ? 'bg-danger bg-opacity-10 border-danger border-2' : ''}`}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <strong className={isDangerous ? 'text-danger' : ''}>
                        {ff.name || 'Brak imienia'}
                      </strong>
                      {isDangerous && <span className="badge bg-danger">⚠️ ZAGROŻONY</span>}
                      {ff.on_mission && <span className="badge bg-primary">Na misji</span>}
                      {ff.team && <span className="badge bg-secondary">{ff.team}</span>}
                    </div>
                    <div className="small text-muted">ID: {ff.badge_number}</div>
                    {ff.time_stationary > 0 && (
                      <div className="small text-warning">Bezruch: {ff.time_stationary.toFixed(1)}min</div>
                    )}
                  </div>
                  <div className="text-end">
                    {ff.vitals && (
                      <>
                        <div className="mb-1">
                          <strong>{ff.vitals.heart_rate || 'N/A'}</strong> <span className="small">BPM</span>
                        </div>
                        <div className={`small ${ff.vitals.battery_level !== null && ff.vitals.battery_level !== undefined 
                          ? (ff.vitals.battery_level < 20 ? 'text-danger' : ff.vitals.battery_level < 50 ? 'text-warning' : 'text-success')
                          : 'text-muted'}`}>
                          {ff.vitals.battery_level !== null && ff.vitals.battery_level !== undefined 
                            ? `${ff.vitals.battery_level.toFixed(0)}% 🔋`
                            : '❓ Bateria nieznana'}
                        </div>
                      </>
                    )}
                    {(!ff.vitals || (ff.vitals.battery_level === null && ff.vitals.battery_level === undefined)) && (
                      <div className="small text-muted">❓ Brak danych</div>
                    )}
                  </div>
                  <div className="ms-2">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        onFirefighterClick(ff.id)
                      }}
                      title="Pokaż na mapie"
                    >
                      🗺️ Mapa
                    </button>
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

export default FirefightersView

