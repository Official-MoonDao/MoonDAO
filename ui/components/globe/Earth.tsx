import { useEffect, useRef, useState } from 'react'
import ReactDOMServer from 'react-dom/server'
import Globe, { GlobeMethods } from 'react-globe.gl'
import useGlobeSize from '@/lib/globe/useGlobeSize'
import CitizenPointLabel from './CitizenPointLabel'
import CitizenPointModal from './CitizenPointModal'

export default function Earth({ pointsData }: any) {
  const size = useGlobeSize()
  const ref = useRef<GlobeMethods | undefined>()
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [pointModalEnabled, setPointModalEnabled] = useState(false)

  useEffect(() => {
    //Change point of view to the center of the US
    if (ref.current) {
      ref.current.pointOfView({
        lat: 39.8283,
        lng: -98.5795,
        altitude: 2,
      })
    }
  }, [ref])

  return (
    <div>
      <Globe
        ref={ref}
        width={size.width}
        height={size.height}
        backgroundColor="#00000000"
        globeImageUrl={
          'https://unpkg.com/three-globe@2.33.0/example/img/earth-night.jpg'
        }
        pointsData={pointsData}
        pointAltitude="size"
        pointColor="color"
        pointRadius={0.5}
        labelSize={1.7}
        pointLabel={(d: any) =>
          ReactDOMServer.renderToString(
            <CitizenPointLabel
              formattedAddress={d.formattedAddress}
              name={d.name}
              citizens={d.citizens}
            />
          )
        }
        onPointClick={(d: any) => {
          setSelectedPoint(d)
          setPointModalEnabled(true)
        }}
        animateIn
      />
      {pointModalEnabled && (
        <CitizenPointModal
          selectedPoint={selectedPoint}
          setEnabled={setPointModalEnabled}
        />
      )}
    </div>
  )
}
