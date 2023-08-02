import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import 'chartjs-adapter-moment'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  TimeScale
)

export default function HoldersChart({ data }: any) {
  const options = {
    responsive: true,

    scales: {
      x: {
        type: 'time',
        title: {
          display: true,
          text: 'Month',
        },
        time: {
          displayFormats: {
            quarter: 'MMM YYYY',
          },
        },
        min: '2022-11-01 00:00:00',
      },
      y: {
        title: {
          display: true,
          text: 'Holders',
        },
        min: 0,
        ticks: {
          stepSize: 25,
        },
      },
    },
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: false,
      },
    },
  }

  const labels = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Holders',
        data,
        borderColor: '#F9B95C80',
        backgroundColor: '#F9B95C50',
      },
    ],
  }

  return (
    <Line
      id="dashboard-analytics-holders"
      options={options as any}
      data={chartData}
    />
  )
}
