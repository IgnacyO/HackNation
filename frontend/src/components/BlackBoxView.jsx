import React, { useState } from 'react'
import { api } from '../utils/api'

function BlackBoxView() {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(null)

  const handleDownload = async () => {
    setDownloading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/export/blackbox')
      if (!response.ok) {
        throw new Error('Błąd podczas pobierania danych')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'blackbox_export.json'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading blackbox:', err)
      setError(err.message || 'Wystąpił błąd podczas pobierania danych')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="blackbox-view p-4" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card shadow-lg" style={{ 
              animation: 'slideInRight 0.5s ease-out',
              border: '2px solid #c82333',
              boxShadow: '0 8px 24px rgba(200, 35, 51, 0.3)'
            }}>
              <div className="card-header" style={{
                background: 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)',
                color: 'white',
                borderBottom: '2px solid rgba(255,255,255,0.2)'
              }}>
                <h4 className="mb-0" style={{ 
                  letterSpacing: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <i className="bi-box-fill"></i> Czarna Skrzynka - Eksport Danych
                </h4>
              </div>
              <div className="card-body">
                <div className="mb-4">
                  <h5 style={{ color: '#c82333', marginBottom: '1rem' }}>Eksport wszystkich danych z bazy</h5>
                  <p style={{ color: '#d0d0d0', lineHeight: '1.6' }}>
                    Pobierz kompletny eksport wszystkich danych z systemu w formacie JSON.
                    Zawiera wszystkie dane o strażakach, pozycjach, parametrach życiowych,
                    alertach i beaconach.
                  </p>
                </div>
                
                <div className="alert" style={{
                  background: 'linear-gradient(135deg, rgba(200, 35, 51, 0.15) 0%, rgba(200, 35, 51, 0.05) 100%)',
                  border: '1px solid rgba(200, 35, 51, 0.3)',
                  color: '#f5f5f5',
                  borderRadius: '8px'
                }}>
                  <strong style={{ color: '#c82333' }}>Zawartość eksportu:</strong>
                  <ul className="mb-0 mt-2" style={{ paddingLeft: '1.5rem' }}>
                    <li>Wszyscy strażacy z pełnymi danymi</li>
                    <li>Wszystkie pozycje (historia ruchu)</li>
                    <li>Wszystkie parametry życiowe (historia vitals)</li>
                    <li>Wszystkie alerty</li>
                    <li>Wszystkie beacony</li>
                    <li>Statystyki eksportu</li>
                  </ul>
                </div>
                
                {error && (
                  <div className="alert alert-danger" style={{
                    animation: 'shake 0.5s ease-out',
                    borderRadius: '8px'
                  }}>
                    <strong>Błąd:</strong> {error}
                  </div>
                )}
                
                <div className="d-grid gap-2">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleDownload}
                    disabled={downloading}
                    style={{
                      background: downloading 
                        ? 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)'
                        : 'linear-gradient(135deg, #c82333 0%, #a01e2a 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.75rem 1.5rem',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      boxShadow: downloading ? 'none' : '0 4px 15px rgba(200, 35, 51, 0.4)',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden',
                      color: 'white'
                    }}
                    onMouseEnter={(e) => {
                      if (!downloading) {
                        e.target.style.transform = 'translateY(-2px)'
                        e.target.style.boxShadow = '0 6px 20px rgba(200, 35, 51, 0.5)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!downloading) {
                        e.target.style.transform = 'translateY(0)'
                        e.target.style.boxShadow = '0 4px 15px rgba(200, 35, 51, 0.4)'
                      }
                    }}
                  >
                    {downloading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Pobieranie...
                      </>
                    ) : (
                      <>
                        <i className="bi-download"></i> Pobierz dane jako JSON
                      </>
                    )}
                  </button>
                </div>
                
                <div className="mt-4">
                  <small style={{ color: '#999999', lineHeight: '1.6' }}>
                    <strong style={{ color: '#c82333' }}>Uwaga:</strong> Plik JSON może być duży w zależności od ilości danych w bazie.
                    Eksport zawiera wszystkie dane historyczne.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BlackBoxView


