import React from 'react'
import { Pie } from 'react-chartjs-2'
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js'

Chart.register(ArcElement, Tooltip, Legend)

const PieChart = ({holdersData}: any) => {
  // Gradient color creation function
  const createGradient = (ctx: any) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400)
    gradient.addColorStop(0, '#425EEB')
    gradient.addColorStop(1, '#6D3F79')
    return gradient
  }

  // Pie chart data and options
  const data = {
    labels: [],
    datasets: [
      {
        label: 'vMooney Held',
        data: holdersData.map((holder: any) => holder.totalvMooney),
        backgroundColor: function (context: any) {
          const chart = context.chart
          const { ctx, chartArea } = chart

          if (!chartArea) {
            // Skip if the chart is not fully rendered
            return null
          }
          return createGradient(ctx)
        },
        borderColor: 'white',
        borderWidth: 2,
      },
    ],
  }

  const options = {
    plugins: {
      legend: {
        labels: {
          color: '#fff', // Change the label color to white for a better look
        },
      },
    },
    responsive: true,
    maintainAspectRatio: true,
  }

  return (
    <Pie data={data} options={options} />
  )
}

export default PieChart