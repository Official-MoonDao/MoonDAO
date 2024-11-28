import { useEffect, useRef, useState } from 'react'
import ReactDOMServer from 'react-dom/server'
import Globe, { GlobeMethods } from 'react-globe.gl'
import useGlobeSize from '@/lib/globe/useGlobeSize'
import CitizenPointLabel from './CitizenPointLabel'
import CitizenPointModal from './CitizenPointModal'

type EarthProps = {
  pointsData: any[]
  enableControls?: boolean
  fixedView?: boolean
}

export default function Earth({ 
  pointsData, 
  enableControls = true, 
  fixedView = false
}: EarthProps) {
  const size = useGlobeSize()
  const globeRef = useRef<GlobeMethods | undefined>()
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [pointModalEnabled, setPointModalEnabled] = useState(false)

  useEffect(() => {
    if (globeRef.current) {
      if (fixedView) {
        globeRef.current.pointOfView({
          lat: 39.8283,
          lng: -98.5795,
          altitude: 2,
        })
      }
      globeRef.current.controls().enableZoom = false
      globeRef.current.controls().enableRotate = enableControls
      globeRef.current.controls().enablePan = enableControls
    }
  }, [globeRef, enableControls, fixedView])

  return (
    <>
      <Globe
        ref={globeRef}
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
