import React, { useState, useEffect } from 'react'
import { api } from '../utils/api'

function RFIDScanner({ onScanSuccess }) {
  const [selectedPort, setSelectedPort] = useState('')
  const [ports, setPorts] = useState([])
  const [scanning, setScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualBadgeNumber, setManualBadgeNumber] = useState('FF-001')

  useEffect(() => {
    loadPorts()
    // Refresh ports every 5 seconds
    const interval = setInterval(loadPorts, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadPorts = async () => {
    try {
      const portList = await api.getSerialPorts()
      setPorts(portList)
      if (portList.length > 0 && !selectedPort) {
        setSelectedPort(portList[0].port)
      }
    } catch (error) {
      console.error('Error loading ports:', error)
      setError('Nie można załadować portów COM')
    }
  }

  const handleManualInputClick = () => {
    setShowManualInput(true)
    setError(null)
  }

  const handleManualInputSubmit = async () => {
    if (!manualBadgeNumber || !manualBadgeNumber.trim()) {
      setError('Wprowadź numer odznaki')
      return
    }

    setLoading(true)
    setError(null)
    setLastScanned(null)
    setShowManualInput(false)

    try {
      // Get firefighter info
      const firefighter = await api.getFirefighterByBadge(manualBadgeNumber.trim())
      
      // Add to mission
      const addResult = await api.addFirefighterToMissionByBadge(manualBadgeNumber.trim())
      
      setLastScanned({
        firefighter: firefighter,
        success: true,
        message: addResult.message
      })
      
      // Refresh firefighters list after successful scan
      if (onScanSuccess) {
        onScanSuccess()
      }
      
      // Show success notification
      setTimeout(() => {
        setLastScanned(null)
      }, 5000)
      
    } catch (error) {
      console.error('Error adding firefighter:', error)
      setError(error.message || 'Błąd podczas dodawania strażaka')
      setLastScanned({
        success: false,
        message: error.message || 'Nie znaleziono strażaka'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleScan = async () => {
    if (!selectedPort) {
      setError('Wybierz port COM lub użyj trybu testowego')
      return
    }

    setLoading(true)
    setError(null)
    setLastScanned(null)

    try {
      // Try to scan from serial port
      const result = await api.scanRFID(selectedPort, 1)
      
      if (result.found && result.firefighter) {
        setLastScanned({
          firefighter: result.firefighter,
          success: true,
          message: result.message || 'Strażak dodany do misji'
        })
        
        // Refresh firefighters list after successful scan
        if (onScanSuccess) {
          onScanSuccess()
        }
        
        // Show success notification
        setTimeout(() => {
          setLastScanned(null)
        }, 5000)
      } else {
        // If no data on serial port, show manual input
        setError('Brak danych z portu COM. Użyj przycisku "Testuj" aby wprowadzić numer ręcznie.')
        setLoading(false)
      }
      
    } catch (error) {
      console.error('Error scanning RFID:', error)
      
      // If serial port error, show manual input option
      if (error.message.includes('No data available') || error.message.includes('Failed to open port')) {
        setError('Błąd portu COM. Użyj przycisku "Testuj" aby wprowadzić numer ręcznie.')
      } else {
        setError(error.message || 'Błąd podczas skanowania RFID')
        setLastScanned({
          success: false,
          message: error.message || 'Nie znaleziono strażaka'
        })
        setLoading(false)
      }
    }
  }

  return (
    <div className="rfid-scanner" style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      zIndex: 1000,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
      border: '2px solid #c82333',
      borderRadius: '8px',
      padding: '1rem',
      minWidth: '350px',
      maxWidth: '400px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
      color: '#f5f5f5',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <h6 className="mb-0" style={{ color: '#f5f5f5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="bi-credit-card-fill" style={{ color: '#c82333' }}></i>
          Skaner RFID
        </h6>
      </div>

      <div className="mb-3">
        <label className="form-label small" style={{ color: '#d0d0d0', marginBottom: '0.5rem' }}>
          Port COM:
        </label>
        <select
          className="form-select form-select-sm"
          value={selectedPort}
          onChange={(e) => setSelectedPort(e.target.value)}
          style={{
            background: '#252525',
            border: '1px solid #333333',
            color: '#f5f5f5'
          }}
        >
          <option value="">Wybierz port...</option>
          {ports.map((port) => (
            <option key={port.port} value={port.port}>
              {port.port} - {port.description || 'Brak opisu'}
            </option>
          ))}
        </select>
        {ports.length === 0 && (
          <div className="small mt-1" style={{ color: '#999999' }}>
            Brak dostępnych portów COM
          </div>
        )}
      </div>

      <div className="d-flex gap-2">
        <button
          className="btn flex-fill"
          onClick={handleScan}
          disabled={!selectedPort || loading}
          style={{
            background: loading || !selectedPort
              ? 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)'
              : 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)',
            border: 'none',
            color: 'white',
            padding: '0.75rem',
            borderRadius: '6px',
            fontWeight: '600',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            if (!loading && selectedPort) {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 4px 12px rgba(200, 35, 51, 0.5)'
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && selectedPort) {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = 'none'
            }
          }}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
              Skanowanie...
            </>
          ) : (
            <>
              <i className="bi-radioactive"></i> Skanuj RFID
            </>
          )}
        </button>
        
        <button
          className="btn flex-fill"
          onClick={handleManualInputClick}
          disabled={loading}
          style={{
            background: loading
              ? 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)'
              : 'linear-gradient(135deg, #198754 0%, #146c43 100%)',
            border: 'none',
            color: 'white',
            padding: '0.75rem',
            borderRadius: '6px',
            fontWeight: '600',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 4px 12px rgba(25, 135, 84, 0.5)'
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = 'none'
            }
          }}
          title="Wprowadź numer odznaki ręcznie"
        >
          <i className="bi-keyboard"></i> Ręczne
        </button>
      </div>

      {/* Manual Input Modal */}
      {showManualInput && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }} onClick={() => setShowManualInput(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
            border: '2px solid #c82333',
            borderRadius: '8px',
            padding: '1.5rem',
            minWidth: '400px',
            maxWidth: '500px',
            color: '#f5f5f5',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)'
          }} onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0" style={{ color: '#f5f5f5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="bi-keyboard-fill" style={{ color: '#198754' }}></i>
                Wprowadź numer odznaki RFID
              </h6>
              <button
                className="btn btn-sm btn-close btn-close-white"
                onClick={() => setShowManualInput(false)}
                style={{ filter: 'brightness(0) invert(1)', opacity: '0.8' }}
              ></button>
            </div>

            <div className="mb-3">
              <label className="form-label" style={{ color: '#d0d0d0', marginBottom: '0.5rem' }}>
                Numer odznaki:
              </label>
              <input
                type="text"
                className="form-control"
                value={manualBadgeNumber}
                onChange={(e) => setManualBadgeNumber(e.target.value)}
                placeholder="np. FF-001"
                style={{
                  background: '#252525',
                  border: '1px solid #333333',
                  color: '#f5f5f5',
                  padding: '0.75rem'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualInputSubmit()
                  }
                }}
                autoFocus
              />
              <div className="small mt-2" style={{ color: '#999999' }}>
                Przykłady: FF-001, FF-002, FF-003, FF-004, FF-005, FF-006
              </div>
            </div>

            <div className="d-flex gap-2">
              <button
                className="btn flex-fill"
                onClick={handleManualInputSubmit}
                disabled={loading || !manualBadgeNumber.trim()}
                style={{
                  background: loading || !manualBadgeNumber.trim()
                    ? 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)'
                    : 'linear-gradient(135deg, #198754 0%, #146c43 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontWeight: '600'
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Dodawanie...
                  </>
                ) : (
                  <>
                    <i className="bi-check-circle"></i> Dodaj do misji
                  </>
                )}
              </button>
              <button
                className="btn flex-fill"
                onClick={() => setShowManualInput(false)}
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontWeight: '600'
                }}
              >
                <i className="bi-x-circle"></i> Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 rounded" style={{
          background: 'rgba(200, 35, 51, 0.2)',
          border: '1px solid #c82333',
          color: '#f5f5f5',
          fontSize: '0.9rem'
        }}>
          <i className="bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}

      {lastScanned && (
        <div className="mt-3 p-3 rounded" style={{
          background: lastScanned.success
            ? 'rgba(25, 135, 84, 0.2)'
            : 'rgba(200, 35, 51, 0.2)',
          border: `1px solid ${lastScanned.success ? '#198754' : '#c82333'}`,
          color: '#f5f5f5'
        }}>
          {lastScanned.success ? (
            <>
              <div className="d-flex align-items-center mb-2">
                <i className="bi-check-circle-fill me-2" style={{ color: '#198754', fontSize: '1.2rem' }}></i>
                <strong>Sukces!</strong>
              </div>
              {lastScanned.firefighter && (
                <div className="small">
                  <div><strong>Strażak:</strong> {lastScanned.firefighter.name}</div>
                  <div><strong>Odznaka:</strong> {lastScanned.firefighter.badge_number}</div>
                  <div><strong>Zespół:</strong> {lastScanned.firefighter.team || 'Brak'}</div>
                </div>
              )}
              <div className="small mt-2" style={{ color: '#d0d0d0' }}>
                {lastScanned.message}
              </div>
            </>
          ) : (
            <>
              <div className="d-flex align-items-center mb-2">
                <i className="bi-x-circle-fill me-2" style={{ color: '#c82333', fontSize: '1.2rem' }}></i>
                <strong>Błąd</strong>
              </div>
              <div className="small">{lastScanned.message}</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default RFIDScanner

