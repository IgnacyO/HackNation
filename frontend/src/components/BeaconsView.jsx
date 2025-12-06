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
        <h4>Wszystkie beacony ({filtered.length})</h4>
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
          <div className="list-group-item text-muted">Brak beaconów</div>
        ) : (
          paginatedBeacons.map((beacon) => (
            <div
              key={beacon.id}
              className="list-group-item list-group-item-action cursor-pointer"
              onClick={() => onBeaconClick && onBeaconClick(beacon.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <strong>{beacon.name}</strong>
                  <div className="small">ID: {beacon.beacon_id}</div>
                  <div className="small">Piętro: {beacon.floor}</div>
                </div>
                <div className="text-end">
                  <span className={beacon.is_online ? 'badge bg-success' : 'badge bg-danger'}>
                    {beacon.is_online ? '🟢 Aktywny' : '🔴 Nieaktywny'}
                  </span>
                  <div className="small mt-1">
                    Bateria: {beacon.battery_percent?.toFixed(0)}%
                  </div>
                  <div className="small">
                    Sygnał: {beacon.signal_quality?.toFixed(0)}%
                  </div>
                  <div className="small">
                    Tagi: {beacon.tags_in_range}
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

