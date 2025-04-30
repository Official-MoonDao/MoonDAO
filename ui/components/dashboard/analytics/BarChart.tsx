import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import React from 'react'
import { Bar } from 'react-chartjs-2'
import { getRelativeQuarter } from '@/lib/utils/dates'

// Register the necessary components for Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function generateQuarterlyDates(numQuarters = 10) {
  const dates = []
  const labels = []

  const now = new Date()

  // Start from 9 quarters ago
  for (let i = -numQuarters; i <= 0; i++) {
    const { quarter, year } = getRelativeQuarter(i)

    // Create date for end of quarter
    const quarterEndDate = new Date(year, quarter * 3, 0, 19, 0, 0)

    // Only include if quarter end date is less than or equal to now
    if (quarterEndDate <= now) {
      dates.push(quarterEndDate.toString())
      labels.push(`${year}Q${quarter}`)
    }
  }

  return { dates, labels }
}

// Generate rolling dates and labels
const { dates: xDates, labels: xLabels } = generateQuarterlyDates()

function sumValuesBeforeDate(dates: any, values: any, targetDate: any) {
  // dates is a list of unsorted dates
  // values are the corresponding values to the dates
  // Returns the sum of the values for the dates that are before targetDate

  const target = new Date(targetDate)

  // Initialize the sum
  let sum = 0

  // Loop through the dates array
  for (let i = 0; i < dates.length; i++) {
    const currentDate = new Date(dates[i])

    // If the current date is less than the target date, add the corresponding value
    if (currentDate <= target) {
      sum += values[i]
    }
  }

  return sum
}

let vMooneyData: any = []

const BarChart = ({ holdersData }: any) => {
  const holderDates = holdersData.map((holder: any) => holder.x)
  const holdervMooney = holdersData.map((holder: any) => holder.totalvMooney)

  xDates.forEach((xDate: any) => {
    vMooneyData.push(sumValuesBeforeDate(holderDates, holdervMooney, xDate))
  })

  // Sample data for the chart
  const data = {
    labels: xLabels,
    datasets: [
      {
        label: 'vMooney Held',
        data: vMooneyData,
        borderColor: '#FFFFFF',
        borderWidth: 2,
        // Border and gradient settings
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart
          const { ctx: chartContext, chartArea } = chart

          if (!chartArea) {
            return null
          }
          // Create gradient fill
          const gradient = chartContext.createLinearGradient(
            0,
            0,
            0,
            chartArea.bottom
          )
          gradient.addColorStop(0, '#425EEB')
          gradient.addColorStop(1, '#6D3F79')

          return gradient
        },
      },
    ],
  }

  // Configuration options for the chart
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#FFFFFF',
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#fff',
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#fff',
        },
      },
    },
    elements: {
      bar: {
        borderSkipped: false, // keep borders on all sides
        borderRadius: 5,
      },
    },
  }

  return <Bar data={data} options={options as any} />
}

export default BarChart
