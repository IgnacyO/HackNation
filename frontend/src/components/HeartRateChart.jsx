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
      <div className="heart-rate-chart-container p-3 bg-light border-top">
        <div className="text-center text-muted">Ładowanie danych...</div>
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
    <div className="heart-rate-chart-container p-3 bg-light border-top">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">Tętno - Strażak ID: {firefighterId}</h6>
        {currentBPM && (
          <div className="d-flex align-items-center gap-2">
            <div className="heart-rate-pulse" style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: 'red',
              animation: 'pulse 1s infinite'
            }}></div>
            <strong className="text-danger">{currentBPM} BPM</strong>
          </div>
        )}
      </div>
      <div style={{ height: '200px' }}>
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

