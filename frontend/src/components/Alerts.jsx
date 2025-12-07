import React, { useEffect, useState, useRef } from 'react'

function Alerts({ alerts, alertTypes, firefighters = [] }) {
  const [currentAlert, setCurrentAlert] = useState(null)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const spokenAlertsRef = useRef(new Set())
  const lastSpokenAlertRef = useRef(null)
  const lastSpeechTimeRef = useRef(0)
  const TTS_COOLDOWN = 2000 // 2 seconds between alerts
  
  // Get firefighter name by ID
  const getFirefighterName = (firefighterId) => {
    if (!firefighterId) return null
    const ff = firefighters.find(f => f.id === firefighterId)
    return ff ? ff.name : null
  }

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
      const firefighterName = getFirefighterName(alert.firefighter_id)
      if (firefighterName) {
        speechText += `. Strażak: ${firefighterName}`
      } else {
        speechText += `. Strażak ID: ${alert.firefighter_id}`
      }
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
    <div 
      className={`alert alert-${severityClass} alert-dismissible fade show m-0`} 
      role="alert"
      style={{
        borderRadius: severityClass === 'danger' ? '0' : '8px',
        border: 'none',
        boxShadow: severityClass === 'danger' 
          ? '0 4px 20px rgba(200, 35, 51, 0.5)' 
          : '0 2px 10px rgba(0, 0, 0, 0.4)',
        animation: severityClass === 'danger' 
          ? 'slideInDown 0.4s ease-out' 
          : 'slideInDown 0.4s ease-out',
        maxWidth: '100%',
        overflow: 'hidden',
        wordWrap: 'break-word',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div className="container-fluid d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3 flex-wrap" style={{ maxWidth: '100%' }}>
          <strong style={{ 
            fontSize: '1.1rem', 
            textShadow: severityClass === 'danger' ? '0 0 5px rgba(0,0,0,0.5)' : 'none',
            color: 'white'
          }}>
            {alertCode}
          </strong>
          <span style={{ fontSize: '0.95rem', color: 'white' }}>{alertInfo.description}</span>
          {currentAlert.firefighter_id && (
            <span 
              className="badge" 
              style={{
                backgroundColor: severityClass === 'danger' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.3)',
                color: 'white',
                padding: '0.4em 0.8em',
                borderRadius: '4px',
                fontWeight: '500'
              }}
            >
              {getFirefighterName(currentAlert.firefighter_id) 
                ? `Strażak: ${getFirefighterName(currentAlert.firefighter_id)}`
                : `Strażak ID: ${currentAlert.firefighter_id}`}
            </span>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          {alertInfo.severity === 'critical' && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setTtsEnabled(!ttsEnabled)
                if (window.speechSynthesis) {
                  window.speechSynthesis.cancel()
                }
              }}
              title={ttsEnabled ? 'Wyłącz odczytywanie' : 'Włącz odczytywanie'}
              style={{
                background: ttsEnabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                borderRadius: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.3)'
                e.target.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = ttsEnabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'
                e.target.style.transform = 'scale(1)'
              }}
            >
              <i className={ttsEnabled ? 'bi-volume-up-fill' : 'bi-volume-mute-fill'}></i>
            </button>
          )}
          <button
            type="button"
            className="btn-close btn-close-white"
            onClick={() => {
              setCurrentAlert(null)
              if (window.speechSynthesis) {
                window.speechSynthesis.cancel()
              }
            }}
            aria-label="Close"
            style={{
              filter: 'brightness(0) invert(1)',
              opacity: '0.8',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.opacity = '1'
              e.target.style.transform = 'scale(1.2)'
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = '0.8'
              e.target.style.transform = 'scale(1)'
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default Alerts

