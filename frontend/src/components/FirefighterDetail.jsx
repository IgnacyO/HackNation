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
      <div className="firefighter-detail" style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
        border: '2px solid #c82333',
        borderRadius: '8px',
        padding: '1rem',
        maxWidth: '320px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
        color: '#f5f5f5'
      }}>
        <div className="spinner-border spinner-border-sm" role="status" style={{ color: '#c82333' }}>
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
    <div className="firefighter-detail" style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 1000,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
      border: '2px solid #c82333',
      borderRadius: '8px',
      padding: '1rem',
      maxWidth: '320px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
      color: '#f5f5f5',
      fontSize: '0.9rem',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <h6 className="mb-0" style={{ color: '#f5f5f5', fontSize: '1rem' }}>Panel parametrów</h6>
        <button 
          className="btn btn-sm btn-close btn-close-white" 
          onClick={onClose}
          style={{ filter: 'brightness(0) invert(1)', opacity: '0.8' }}
        ></button>
      </div>
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Tętno i Bateria w jednym rzędzie */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            {/* Tętno */}
            <div style={{ flex: 1 }}>
              <div className="small" style={{ color: '#999999', marginBottom: '0.25rem' }}>Tętno</div>
              <div className="fw-bold" style={{ color: '#f5f5f5' }}>
                {data.vitals && data.vitals.heart_rate !== null && data.vitals.heart_rate !== undefined
                  ? `${data.vitals.heart_rate} BPM`
                  : 'N/A'}
              </div>
            </div>
            
            {/* Bateria - zawsze wyświetlana */}
            <div style={{ flex: 1 }}>
              <div className="small" style={{ color: '#999999', marginBottom: '0.25rem' }}>Bateria</div>
              <div className="fw-bold" style={{ 
                color: data.vitals && data.vitals.battery_level !== null && data.vitals.battery_level !== undefined
                  ? (data.vitals.battery_level < 20 ? '#c82333' : data.vitals.battery_level < 50 ? '#ffc107' : '#198754')
                  : '#999999',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                {data.vitals && data.vitals.battery_level !== null && data.vitals.battery_level !== undefined
                  ? (
                    <>
                      {data.vitals.battery_level.toFixed(0)}% <i className="bi-battery-half"></i>
                    </>
                  )
                  : (
                    <>
                      <i className="bi-question-circle"></i> Nieznana
                    </>
                  )}
              </div>
            </div>
          </div>
          
          {/* Stan ruchu */}
          <div>
            <div className="small" style={{ color: '#999999', marginBottom: '0.25rem' }}>Stan ruchu</div>
            <div className="fw-bold" style={{ 
              color: data.movement_status === 'bezruch' ? '#c82333' : '#198754',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <i className={data.movement_status === 'bezruch' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}></i>
              {data.movement_status === 'bezruch' ? 'Bezruch' : 'Ruch'}
            </div>
            {data.time_stationary > 0 && (
              <div className="small" style={{ color: '#999999', marginTop: '0.25rem' }}>
                Czas bezruchu: {formatTime(data.time_stationary)}
              </div>
            )}
          </div>
          
          {/* Beacon */}
          {data.beacon ? (
            <div>
              <div className="small" style={{ color: '#999999', marginBottom: '0.25rem' }}>Ostatni beacon</div>
              <div className="small" style={{ color: '#d0d0d0' }}>
                <i className="bi-broadcast"></i> {data.beacon.name} ({data.beacon.distance}m)
              </div>
            </div>
          ) : (
            <div>
              <div className="small" style={{ color: '#999999', marginBottom: '0.25rem' }}>Ostatni beacon</div>
              <div className="small" style={{ color: '#999999' }}>Brak beaconu w zasięgu</div>
            </div>
          )}
          
          {/* Last Position */}
          {data.last_position && (
            <div>
              <div className="small" style={{ color: '#999999', marginBottom: '0.25rem' }}>Ostatnia pozycja</div>
              <div className="small" style={{ color: '#d0d0d0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <i className="bi-geo-alt-fill" style={{ color: '#c82333' }}></i>
                  Piętro: {data.last_position.floor}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999999', marginTop: '0.25rem' }}>
                  {data.last_position.latitude.toFixed(6)}, {data.last_position.longitude.toFixed(6)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999999' }}>
                  {formatDateTime(data.last_position.timestamp)}
                </div>
              </div>
            </div>
          )}
          
          {/* Last Contact Time */}
          {data.last_contact && data.last_contact.seconds_ago !== null && (
            <div>
              <div className="small" style={{ color: '#999999', marginBottom: '0.25rem' }}>Ostatni kontakt</div>
              <div className={`small fw-bold`} style={{ 
                color: data.last_contact.seconds_ago > 300 ? '#c82333' : data.last_contact.seconds_ago > 60 ? '#ffc107' : '#198754'
              }}>
                {formatTime(data.last_contact.seconds_ago)} temu
              </div>
              {data.last_contact.timestamp && (
                <div style={{ fontSize: '0.75rem', color: '#999999', marginTop: '0.25rem' }}>
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

