import React, { useEffect, useState, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { api } from '../utils/api'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function HeartRateChart({ firefighterId }) {
  const [vitalsData, setVitalsData] = useState([])
  const [currentBPM, setCurrentBPM] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    const loadVitals = async () => {
      try {
        const vitals = await api.getFirefighterVitals(firefighterId, 100)
        setVitalsData(vitals)
        if (vitals.length > 0) {
          setCurrentBPM(vitals[vitals.length - 1].heart_rate)
        }
      } catch (error) {
        console.error('Error loading vitals:', error)
      }
    }

    loadVitals()

    // Refresh every 1.5 seconds
    intervalRef.current = setInterval(loadVitals, 1500)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [firefighterId])

  if (vitalsData.length === 0) {
    return (
      <div className="heart-rate-chart-container" style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        zIndex: 1000,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
        border: '2px solid #c82333',
        borderRadius: '8px',
        padding: '0.75rem',
        width: '300px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
        color: '#f5f5f5'
      }}>
        <div className="text-center" style={{ color: '#999999', fontSize: '0.9rem' }}>Ładowanie danych...</div>
      </div>
    )
  }

  // Prepare chart data
  const labels = vitalsData.map((v, index) => index)
  const heartRateValues = vitalsData.map(v => v.heart_rate)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Tętno (BPM)',
        data: heartRateValues,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        tension: 0,
        pointRadius: 0,
        fill: true,
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true
      }
    },
    scales: {
      x: {
        display: false
      },
      y: {
        beginAtZero: false,
        min: Math.min(...heartRateValues) - 10,
        max: Math.max(...heartRateValues) + 10
      }
    },
    elements: {
      line: {
        borderWidth: 2
      }
    }
  }

  return (
    <div className="heart-rate-chart-container" style={{
      position: 'absolute',
      bottom: '10px',
      left: '10px',
      zIndex: 1000,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
      border: '2px solid #c82333',
      borderRadius: '8px',
      padding: '0.75rem',
      width: '280px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
      color: '#f5f5f5',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0" style={{ color: '#f5f5f5', fontSize: '0.9rem' }}>Tętno</h6>
        {currentBPM && (
          <div className="d-flex align-items-center gap-2">
            <div className="heart-rate-pulse" style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#c82333',
              animation: 'pulse 1s infinite'
            }}></div>
            <strong style={{ color: '#c82333', fontSize: '0.9rem' }}>{currentBPM} BPM</strong>
          </div>
        )}
      </div>
      <div style={{ height: '120px' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  )
}

export default HeartRateChart

