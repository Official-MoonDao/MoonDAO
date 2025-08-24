import { useEffect, useRef, useState } from 'react'
import ReactDOMServer from 'react-dom/server'
import Globe, { GlobeMethods } from 'react-globe.gl'
import useGlobeSize from '@/lib/globe/useGlobeSize'
import CitizenPointLabel from './CitizenPointLabel'
import CitizenPointModal from './CitizenPointModal'

type EarthProps = {
  pointsData: any[]
  width?: number
  height?: number
}

export default function Earth({ pointsData, width, height }: EarthProps) {
  const defaultSize = useGlobeSize()
  const size = width && height ? { width, height } : defaultSize
  const globeRef = useRef<GlobeMethods | undefined>()
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [pointModalEnabled, setPointModalEnabled] = useState(false)

  useEffect(() => {
    //Change point of view to the center of the US
    if (globeRef.current) {
      globeRef.current.pointOfView({
        lat: 39.8283,
        lng: -98.5795,
        altitude: 2,
      })
    }
  }, [globeRef])

  return (
    <>
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor="#00000000"
        globeImageUrl={'/react-globe/earth-night.jpg'}
        pointsData={pointsData}
        pointAltitude="size"
        pointColor="color"
        pointRadius={0.5}
        labelSize={1.7}
        pointLabel={(d: any) =>
          ReactDOMServer.renderToString(
            <CitizenPointLabel
              formattedAddress={d.formattedAddress}
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
    </>
  )
}
