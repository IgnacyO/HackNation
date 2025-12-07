import React, { useState, useEffect } from 'react'
import { api } from '../utils/api'

function BeaconsView({ onBeaconClick }) {
  const [beacons, setBeacons] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    loadBeacons()
    const interval = setInterval(loadBeacons, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadBeacons = async () => {
    try {
      // Get all beacons (no floor filter)
      const data = await api.getBeacons(null)
      setBeacons(data)
    } catch (error) {
      console.error('Error loading beacons:', error)
    }
  }

  const filtered = beacons.filter(beacon => {
    const matchesSearch = beacon.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         beacon.beacon_id?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && beacon.is_online) ||
                         (statusFilter === 'inactive' && !beacon.is_online)
    const matchesFloor = floorFilter === 'all' ||
                         beacon.floor === parseInt(floorFilter)
    return matchesSearch && matchesStatus && matchesFloor
  })

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedBeacons = filtered.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo(0, 0)
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, floorFilter])

  // Get unique floors from beacons
  const floors = [...new Set(beacons.map(b => b.floor).filter(f => f !== null && f !== undefined))].sort()

  return (
    <div className="beacons-view p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 style={{ 
          color: '#f5f5f5',
          fontWeight: 'bold',
          letterSpacing: '1px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <i className="bi-broadcast-fill" style={{ color: '#c82333' }}></i>
          Wszystkie beacony ({filtered.length})
        </h4>
        <div className="d-flex gap-2">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Szukaj..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '200px' }}
          />
          <select
            className="form-select form-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Wszystkie</option>
            <option value="active">Aktywne</option>
            <option value="inactive">Nieaktywne</option>
          </select>
          <select
            className="form-select form-select-sm"
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
          >
            <option value="all">Wszystkie piętra</option>
            {floors.map(floor => (
              <option key={floor} value={floor}>Piętro {floor}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="list-group">
        {paginatedBeacons.length === 0 ? (
          <div className="list-group-item" style={{ color: '#999999', textAlign: 'center', padding: '2rem' }}>
            Brak beaconów
          </div>
        ) : (
          paginatedBeacons.map((beacon) => (
            <div
              key={beacon.id}
              className="list-group-item cursor-pointer"
              onClick={() => onBeaconClick && onBeaconClick(beacon.id)}
              style={{ 
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
                border: '1px solid #333333',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                color: '#f5f5f5',
                transition: 'all 0.3s ease',
                animation: 'fadeIn 0.4s ease-out'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(5px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)'
                e.currentTarget.style.borderColor = '#c82333'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = '#333333'
              }}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <strong style={{ color: '#f5f5f5' }}>{beacon.name}</strong>
                  <div className="small" style={{ color: '#999999' }}>ID: {beacon.beacon_id}</div>
                  <div className="small" style={{ color: '#999999' }}>Piętro: {beacon.floor}</div>
                </div>
                <div className="text-end">
                  <span className="badge" style={{
                    background: beacon.is_online 
                      ? 'linear-gradient(135deg, #198754 0%, #146c43 100%)'
                      : 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)',
                    color: 'white',
                    marginBottom: '0.5rem'
                  }}>
                    <i className={beacon.is_online ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}></i> {beacon.is_online ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                  <div className="small mt-1" style={{ color: '#d0d0d0' }}>
                    <i className="bi-battery-half"></i> Bateria: {beacon.battery_percent?.toFixed(0)}%
                  </div>
                  <div className="small" style={{ color: '#d0d0d0' }}>
                    <i className="bi-signal"></i> Sygnał: {beacon.signal_quality?.toFixed(0)}%
                  </div>
                  <div className="small" style={{ color: '#d0d0d0' }}>
                    <i className="bi-tags"></i> Tagi: {beacon.tags_in_range}
                  </div>
                </div>
              </div>
            </div>
          ))
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

export default BeaconsView

