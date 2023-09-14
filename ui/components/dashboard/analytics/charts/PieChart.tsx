//@ts-nocheck
import { Chart, ArcElement } from 'chart.js'
import { Pie } from 'react-chartjs-2'

Chart.register(ArcElement)

export default function PieChart({ data }: any) {
  data.sort((a: any, b: any) => b.value - a.value)
  const labels = data.map(
    (h: any) => h.address.slice(0, 6) + '...' + h.address.slice(-4)
  )
  const values = data.map((h: any) => h.totalvMooney)

  const sum = data.map((data) => data.value).reduce((a, b) => a + b)
  console.log(sum)

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Voting Power',
        data: values,
        borderWidth: 1,
        //background Colors from red to light gold, total of 6
        backgroundColor: ['#F9B95C', '#F5A33180', '#5CB9F980', '#FFFFF080'],
        //border Colors from red to light gold, total of 6
        borderColor: ['#F9B95C', '#F5A331', '#5CB9F9', '#FFFDD0'],
      },
    ],
  }

  return (
    <div id="dashboard-analytics-pie" className="w-1/2 p-8 min-w-[300px]">
      <Pie data={chartData} />
    </div>
  )
}
