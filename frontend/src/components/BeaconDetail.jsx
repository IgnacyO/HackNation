import React, { useState, useEffect } from 'react'
import { api } from '../utils/api'

function BeaconDetail({ beaconId, onClose }) {
  const [firefighters, setFirefighters] = useState([])
  const [beacon, setBeacon] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [beaconData, firefightersData] = await Promise.all([
          api.getBeacon(beaconId),
          api.getBeaconFirefighters(beaconId)
        ])
        setBeacon(beaconData)
        setFirefighters(firefightersData)
      } catch (error) {
        console.error('Error loading beacon detail:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [beaconId])

  if (loading) {
    return (
      <div className="beacon-detail" style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
        border: '2px solid #c82333',
        borderRadius: '8px',
        padding: '1rem',
        maxWidth: '400px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
        color: '#f5f5f5'
      }}>
        <div className="spinner-border spinner-border-sm" role="status" style={{ color: '#c82333' }}>
          <span className="visually-hidden">Ładowanie...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="beacon-detail" style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 1000,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
      border: '2px solid #c82333',
      borderRadius: '8px',
      padding: '1rem',
      maxWidth: '400px',
      maxHeight: '80vh',
      overflowY: 'auto',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
      color: '#f5f5f5',
      fontSize: '0.9rem',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <h5 style={{ color: '#f5f5f5', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="bi-broadcast-fill" style={{ color: '#c82333' }}></i>
          {beacon ? beacon.name : 'Beacon'}
        </h5>
        <button 
          className="btn btn-sm btn-close btn-close-white" 
          onClick={onClose}
          style={{ filter: 'brightness(0) invert(1)', opacity: '0.8' }}
        ></button>
      </div>
      
      {beacon && (
        <div className="mb-3 p-3 rounded" style={{
          background: 'linear-gradient(135deg, rgba(200, 35, 51, 0.15) 0%, rgba(200, 35, 51, 0.05) 100%)',
          border: '1px solid rgba(200, 35, 51, 0.3)',
          color: '#f5f5f5'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong style={{ color: '#f5f5f5' }}>Status:</strong>
            <span style={{ 
              color: beacon.is_online ? '#198754' : '#c82333',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <i className={beacon.is_online ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}></i>
              {beacon.is_online ? 'Aktywny' : 'Nieaktywny'}
            </span>
          </div>
          <div className="small" style={{ color: '#d0d0d0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div><strong style={{ color: '#f5f5f5' }}>ID:</strong> {beacon.beacon_id}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong style={{ color: '#f5f5f5' }}>Bateria:</strong> 
              <span style={{
                color: beacon.battery_percent < 20 ? '#c82333' : beacon.battery_percent < 50 ? '#ffc107' : '#198754'
              }}>
                {beacon.battery_percent?.toFixed(0)}% <i className="bi-battery-half"></i>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong style={{ color: '#f5f5f5' }}>Sygnał:</strong> 
              <i className="bi-signal"></i> {beacon.signal_quality?.toFixed(0)}%
            </div>
            <div><strong style={{ color: '#f5f5f5' }}>Tagi w zasięgu:</strong> {beacon.tags_in_range}</div>
            <div><strong style={{ color: '#f5f5f5' }}>Ostatnio widziany:</strong> {new Date(beacon.last_seen).toLocaleString('pl-PL')}</div>
          </div>
        </div>
      )}
      
      <h6 className="mb-2" style={{ color: '#f5f5f5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <i className="bi-people-fill" style={{ color: '#c82333' }}></i>
        Strażacy w zasięgu
      </h6>
      {firefighters.length === 0 ? (
        <p style={{ color: '#999999', textAlign: 'center', padding: '1rem' }}>Brak strażaków w zasięgu</p>
      ) : (
        <div className="list-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {firefighters.map((item) => (
            <div 
              key={item.firefighter.id} 
              className="list-group-item"
              style={{
                background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
                border: '1px solid #333333',
                borderRadius: '8px',
                color: '#f5f5f5',
                transition: 'all 0.3s ease',
                padding: '0.75rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#c82333'
                e.currentTarget.style.transform = 'translateX(5px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333333'
                e.currentTarget.style.transform = 'translateX(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <strong style={{ color: '#f5f5f5' }}>{item.firefighter.name}</strong>
                  <div className="small" style={{ color: '#999999', marginTop: '0.25rem' }}>{item.firefighter.badge_number}</div>
                </div>
                <div className="text-end">
                  <div className="small" style={{ color: '#d0d0d0', marginBottom: '0.25rem' }}>
                    <i className="bi-rulers"></i> Odległość: {item.distance}m
                  </div>
                  {item.vitals && (
                    <div className="small" style={{ color: '#f5f5f5', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                      <i className="bi-heart-pulse-fill" style={{ color: '#c82333' }}></i>
                      {item.vitals.heart_rate} BPM
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BeaconDetail

