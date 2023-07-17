//@ts-nocheck
import { ResponsiveBar } from '@nivo/bar'

// make sure parent container have a defined height when using
// responsive component, otherwise height will be 0 and
// no chart will be rendered.
function Balance({ data }: any) {
  if (!data) return
  return (
    <div className="text-black">
      <ResponsiveBar
        data={data}
        keys={['balance']}
        indexBy="date"
        margin={{ top: 20, right: 50, bottom: 50, left: 50 }}
        padding={0.3}
        maxValue={'auto'}
        groupMode="grouped"
        gridXValues={false}
        gridYValues={false}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={{ scheme: 'nivo' }}
        defs={[
          {
            id: 'lines',
            type: 'patternDots',
            background: 'inherit',
            color: '#D7594F',
            size: 4,
            spacing: 5,
          },
        ]}
        borderColor={{
          from: 'color',
          modifiers: [['darker', 0.5]],
        }}
        axisTop={null}
        axisRight={null}
        axisBottom={false}
        // colors={["skyblue", "slategrey", "cyan", "grey"]}
        colorBy="index"
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          format: '.2s',
          legend: '',
          legendPosition: 'middle',
          legendOffset: -40,
        }}
        labelSkipWidth={12}
        labelSkipHeight={12}
        role="application"
        theme={{
          textColor: 'white',
        }}
        legends={[
          {
            itemTextColor: 'white',
            anchor: 'bottom-right',
            direction: 'column',
            justify: false,
            translateX: 10,
            translateY: 50,
            itemsSpacing: 0,
            itemDirection: 'left-to-right',
            itemWidth: 80,
            itemHeight: 20,
            itemOpacity: 0.85,
            symbolSize: 12,
            symbolShape: 'circle',
            symbolBorderColor: 'rgba(0, 0, 0, .5)',
          },
        ]}
      />
    </div>
  )
}
export default Balance
