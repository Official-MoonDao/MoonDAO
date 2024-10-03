import React from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

// Register the necessary components for Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const xDates = [
  "Sat Dec 31 2022 19:00:00 GMT-0600 (Central Standard Time)",
  "Fri Mar 31 2023 19:00:00 GMT-0500 (Central Daylight Time)",
  "Fri Jun 30 2023 19:00:00 GMT-0500 (Central Daylight Time)",
  "Sat Sep 30 2023 19:00:00 GMT-0500 (Central Daylight Time)",
  "Sun Dec 31 2023 19:00:00 GMT-0600 (Central Standard Time)",
  "Sun Mar 31 2024 19:00:00 GMT-0500 (Central Daylight Time)",
  "Sun Jun 30 2024 19:00:00 GMT-0500 (Central Daylight Time)",
  "Mon Sep 30 2024 19:00:00 GMT-0500 (Central Daylight Time)"
]

const xLabels = [
  "2022Q4",
  "2023Q1",
  "2023Q2",
  "2023Q3",
  "2023Q4",
  "2024Q1",
  "2024Q2",
  "2024Q3"
]

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

const BarChart = ({holdersData}: any) => {
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
          const gradient = chartContext.createLinearGradient(0, 0, 0, chartArea.bottom)
          gradient.addColorStop(0, '#425EEB')
          gradient.addColorStop(1, '#6D3F79')

          return gradient
        },
      }
    ]
  }

  // Configuration options for the chart
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#FFFFFF'
        },
      },
      title: {
        display: false,
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#fff'
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#fff'
        }
      }
    },
    elements: {
      bar: {
        borderSkipped: false, // keep borders on all sides
        borderRadius: 5,
      }
    }
  }

  return <Bar data={data} options={options} />
}

export default BarChart