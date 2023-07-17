//@ts-nocheck
import { ResponsiveLine } from '@nivo/line'

// make sure parent container have a defined height when using
// responsive component, otherwise height will be 0 and
// no chart will be rendered.
function Holders({ data, lightMode }: any) {
  if (!data) return
  const formattedData = [
    {
      id: 'holders',
      data: data,
    },
  ]

  return (
    <div className="h-[400px] w-[335px] lg:h-[480px] lg:w-[650px]  2xl:h-[540px] 2xl:w-[850px] text-black">
      <ResponsiveLine
        data={formattedData}
        key={'holders'}
        margin={{ top: 50, right: 75, bottom: 100, left: 50 }}
        yScale={{
          type: 'linear',
          min: '0',
          max: `${data.length + 10}`,
          reverse: false,
          nice: true,
        }}
        xScale={{ format: '%Y-%m-%d %H:%M', type: 'time', precision: 'minute' }}
        xFormat="time:%Y-%m-%d"
        axisLeft={null}
        axisRight={{
          tickSize: 12,
          tickPadding: 10,
          format: '.2s',
          legend: '',
          legendOffset: 0,
          legendPosition: 'middle',
        }}
        axisBottom={{
          tickValues: 'every month',
          tickSize: 12,
          tickRotation: 0,
          tickPadding: 10,
          format: '%m-%y',
          orient: 'bottom',
          legend: '',
          legendOffset: 45,
          legendPosition: 'middle',
        }}
        enableGridX={false}
        enableGridY={false}
        pointSize={0}
        pointColor="black"
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        useMesh={true}
        theme={{
          textColor: 'slategrey',
        }}
        colors={lightMode ? ['skyblue'] : ['orange']}
        legends={[
          {
            itemTextColor: 'slategrey',
            anchor: 'bottom-right',
            direction: 'column',
            justify: false,
            translateX: 60,
            translateY: 75,
            itemsSpacing: 0,
            itemDirection: 'left-to-right',
            itemWidth: 80,
            itemHeight: 20,
            itemOpacity: 0.85,
            symbolSize: 12,
            symbolShape: 'circle',
            symbolBorderColor: 'rgba(0, 0, 0, .5)',
            effects: [
              {
                on: 'hover',
                style: {
                  itemBackground: 'rgba(0, 0, 0, .03)',
                  itemOpacity: 1,
                },
              },
            ],
          },
        ]}
      />
    </div>
  )
}

export default Holders
