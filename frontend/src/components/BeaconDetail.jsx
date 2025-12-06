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
      <div className="beacon-detail p-4">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Ładowanie...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="beacon-detail p-4">
      <div className="d-flex justify-content-between mb-3">
        <h5>{beacon ? beacon.name : 'Beacon'}</h5>
        <button className="btn btn-sm btn-secondary" onClick={onClose}>Zamknij</button>
      </div>
      
      {beacon && (
        <div className="mb-3 p-3 bg-light rounded">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>Status:</strong>
            <span className={beacon.is_online ? 'text-success' : 'text-danger'}>
              {beacon.is_online ? '🟢 Aktywny' : '🔴 Nieaktywny'}
            </span>
          </div>
          <div className="small">
            <div>ID: {beacon.beacon_id}</div>
            <div>Bateria: {beacon.battery_percent?.toFixed(0)}%</div>
            <div>Sygnał: {beacon.signal_quality?.toFixed(0)}%</div>
            <div>Tagi w zasięgu: {beacon.tags_in_range}</div>
            <div>Ostatnio widziany: {new Date(beacon.last_seen).toLocaleString()}</div>
          </div>
        </div>
      )}
      
      <h6 className="mb-2">Strażacy w zasięgu</h6>
      {firefighters.length === 0 ? (
        <p className="text-muted">Brak strażaków w zasięgu</p>
      ) : (
        <div className="list-group">
          {firefighters.map((item) => (
            <div key={item.firefighter.id} className="list-group-item">
              <div className="d-flex justify-content-between">
                <div>
                  <strong>{item.firefighter.name}</strong>
                  <div className="small">{item.firefighter.badge_number}</div>
                </div>
                <div className="text-end">
                  <div className="small">Odległość: {item.distance}m</div>
                  {item.vitals && (
                    <div className="small">{item.vitals.heart_rate} BPM</div>
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

