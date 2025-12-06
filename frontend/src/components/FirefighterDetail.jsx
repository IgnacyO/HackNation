import React, { useState, useEffect } from 'react'
import { api } from '../utils/api'

function FirefighterDetail({ firefighterId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const beaconData = await api.getFirefighterBeacon(firefighterId)
        setData(beaconData)
      } catch (error) {
        console.error('Error loading firefighter detail:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
    const interval = setInterval(loadData, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [firefighterId])

  if (loading) {
    return (
      <div className="firefighter-detail p-3 bg-light border-bottom">
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Ładowanie...</span>
        </div>
      </div>
    )
  }

  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds.toFixed(0)}s`
    }
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (minutes < 60) {
      return `${minutes}m ${secs.toFixed(0)}s`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatDateTime = (isoString) => {
    if (!isoString) return 'Nieznany'
    const date = new Date(isoString)
    return date.toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="firefighter-detail p-3 bg-light border-bottom">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <h6 className="mb-0">Panel parametrów</h6>
        <button className="btn btn-sm btn-close" onClick={onClose}></button>
      </div>
      {data && (
        <div className="row g-2">
          {/* Tętno */}
          {data.vitals && data.vitals.heart_rate !== null && (
            <div className="col-6">
              <div className="small text-muted">Tętno</div>
              <div className="fw-bold">{data.vitals.heart_rate} BPM</div>
            </div>
          )}
          
          {/* Bateria */}
          {data.vitals && data.vitals.battery_level !== null && (
            <div className="col-6">
              <div className="small text-muted">Bateria</div>
              <div className="fw-bold">{data.vitals.battery_level.toFixed(0)}%</div>
            </div>
          )}
          
          {/* Stan ruchu */}
          <div className="col-12 mt-2">
            <div className="small text-muted">Stan ruchu</div>
            <div className={`fw-bold ${data.movement_status === 'bezruch' ? 'text-danger' : 'text-success'}`}>
              {data.movement_status === 'bezruch' ? '🔴 Bezruch' : '🟢 Ruch'}
            </div>
            {data.time_stationary > 0 && (
              <div className="small text-muted mt-1">
                Czas bezruchu: {formatTime(data.time_stationary)}
              </div>
            )}
          </div>
          
          {/* Beacon */}
          {data.beacon ? (
            <div className="col-12 mt-2">
              <div className="small text-muted">Ostatni beacon</div>
              <div className="small">{data.beacon.name} ({data.beacon.distance}m)</div>
            </div>
          ) : (
            <div className="col-12 mt-2">
              <div className="small text-muted">Brak beaconu w zasięgu</div>
            </div>
          )}
          
          {/* Last Position */}
          {data.last_position && (
            <div className="col-12 mt-2">
              <div className="small text-muted">Ostatnia pozycja</div>
              <div className="small">
                <div>📍 Piętro: {data.last_position.floor}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {data.last_position.latitude.toFixed(6)}, {data.last_position.longitude.toFixed(6)}
                </div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {formatDateTime(data.last_position.timestamp)}
                </div>
              </div>
            </div>
          )}
          
          {/* Last Contact Time */}
          {data.last_contact && data.last_contact.seconds_ago !== null && (
            <div className="col-12 mt-2">
              <div className="small text-muted">Ostatni kontakt</div>
              <div className={`small fw-bold ${data.last_contact.seconds_ago > 60 ? 'text-warning' : data.last_contact.seconds_ago > 300 ? 'text-danger' : 'text-success'}`}>
                {formatTime(data.last_contact.seconds_ago)} temu
              </div>
              {data.last_contact.timestamp && (
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {formatDateTime(data.last_contact.timestamp)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FirefighterDetail

