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
    <div className="blackbox-view p-4">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card shadow">
              <div className="card-header bg-dark text-white">
                <h4 className="mb-0">📦 Czarna Skrzynka - Eksport Danych</h4>
              </div>
              <div className="card-body">
                <div className="mb-4">
                  <h5>Eksport wszystkich danych z bazy</h5>
                  <p className="text-muted">
                    Pobierz kompletny eksport wszystkich danych z systemu w formacie JSON.
                    Zawiera wszystkie dane o strażakach, pozycjach, parametrach życiowych,
                    alertach i beaconach.
                  </p>
                </div>
                
                <div className="alert alert-info">
                  <strong>Zawartość eksportu:</strong>
                  <ul className="mb-0 mt-2">
                    <li>Wszyscy strażacy z pełnymi danymi</li>
                    <li>Wszystkie pozycje (historia ruchu)</li>
                    <li>Wszystkie parametry życiowe (historia vitals)</li>
                    <li>Wszystkie alerty</li>
                    <li>Wszystkie beacony</li>
                    <li>Statystyki eksportu</li>
                  </ul>
                </div>
                
                {error && (
                  <div className="alert alert-danger">
                    <strong>Błąd:</strong> {error}
                  </div>
                )}
                
                <div className="d-grid gap-2">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Pobieranie...
                      </>
                    ) : (
                      <>
                        📥 Pobierz dane jako JSON
                      </>
                    )}
                  </button>
                </div>
                
                <div className="mt-4">
                  <small className="text-muted">
                    <strong>Uwaga:</strong> Plik JSON może być duży w zależności od ilości danych w bazie.
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


