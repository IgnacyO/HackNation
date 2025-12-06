import React, { useEffect, useState, useRef } from 'react'

function Alerts({ alerts, alertTypes }) {
  const [currentAlert, setCurrentAlert] = useState(null)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const spokenAlertsRef = useRef(new Set())
  const lastSpokenAlertRef = useRef(null)
  const lastSpeechTimeRef = useRef(0)
  const TTS_COOLDOWN = 2000 // 2 seconds between alerts

  // Text-to-speech function
  const speakAlert = (alert) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return
    
    const alertInfo = alertTypes[alert.alert_type] || {
      severity: 'warning',
      description: alert.message || alert.alert_type
    }
    
    // Only speak critical alerts
    if (alertInfo.severity !== 'critical') return
    
    // Don't speak the same alert multiple times
    const alertKey = `${alert.id}-${alert.timestamp}`
    if (spokenAlertsRef.current.has(alertKey)) return
    
    // Don't speak if it's the same alert as last time
    if (lastSpokenAlertRef.current === alertKey) return
    
    // Rate limiting: don't speak more than once per 2 seconds
    const now = Date.now()
    const timeSinceLastSpeech = now - lastSpeechTimeRef.current
    if (timeSinceLastSpeech < TTS_COOLDOWN) {
      console.log(`TTS cooldown: ${TTS_COOLDOWN - timeSinceLastSpeech}ms remaining`)
      return
    }
    
    const alertCode = alert.alert_type.toUpperCase().replace(/_/g, ' ')
    const description = alertInfo.description
    
    // Create speech text
    let speechText = `ALERT KRYTYCZNY: ${alertCode}. ${description}`
    
    if (alert.firefighter_id) {
      speechText += `. Strażak ID: ${alert.firefighter_id}`
    }
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel()
    
    // Create and speak
    const utterance = new SpeechSynthesisUtterance(speechText)
    utterance.lang = 'pl-PL'
    utterance.rate = 0.9 // Slightly slower for clarity
    utterance.pitch = 1.2 // Slightly higher pitch for urgency
    utterance.volume = 1.0
    
    utterance.onstart = () => {
      // Mark speech time when it starts
      lastSpeechTimeRef.current = Date.now()
      spokenAlertsRef.current.add(alertKey)
      lastSpokenAlertRef.current = alertKey
    }
    
    utterance.onend = () => {
      // Clean up old spoken alerts (keep only last 10)
      if (spokenAlertsRef.current.size > 10) {
        const firstKey = Array.from(spokenAlertsRef.current)[0]
        spokenAlertsRef.current.delete(firstKey)
      }
    }
    
    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error)
    }
    
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    if (alerts.length > 0) {
      // Show the most recent unacknowledged alert
      const latest = alerts[0]
      setCurrentAlert(latest)
      
      // Speak critical alerts
      const criticalAlerts = alerts.filter(a => {
        const info = alertTypes[a.alert_type] || { severity: 'warning' }
        return info.severity === 'critical'
      })
      
      if (criticalAlerts.length > 0) {
        // Speak the most recent critical alert
        speakAlert(criticalAlerts[0])
      }
    } else {
      setCurrentAlert(null)
    }
  }, [alerts, alertTypes, ttsEnabled])

  if (!currentAlert) return null

  const alertInfo = alertTypes[currentAlert.alert_type] || {
    severity: 'warning',
    description: currentAlert.message || currentAlert.alert_type
  }

  const severityClass = alertInfo.severity === 'critical' ? 'danger' : 'warning'
  const alertCode = currentAlert.alert_type.toUpperCase().replace(/_/g, ' ')

  return (
    <div className={`alert alert-${severityClass} alert-dismissible fade show m-0 rounded-0`} role="alert">
      <div className="container-fluid d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3">
          <strong>{alertCode}</strong>
          <span>{alertInfo.description}</span>
          {currentAlert.firefighter_id && (
            <span className="badge bg-secondary">
              Strażak ID: {currentAlert.firefighter_id}
            </span>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          {alertInfo.severity === 'critical' && (
            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={() => {
                setTtsEnabled(!ttsEnabled)
                if (window.speechSynthesis) {
                  window.speechSynthesis.cancel()
                }
              }}
              title={ttsEnabled ? 'Wyłącz odczytywanie' : 'Włącz odczytywanie'}
            >
              {ttsEnabled ? '🔊' : '🔇'}
            </button>
          )}
          <button
            type="button"
            className="btn-close"
            onClick={() => {
              setCurrentAlert(null)
              if (window.speechSynthesis) {
                window.speechSynthesis.cancel()
              }
            }}
            aria-label="Close"
          />
        </div>
      </div>
    </div>
  )
}

export default Alerts

