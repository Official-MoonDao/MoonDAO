import { useEffect, useRef, useState } from 'react'
import ReactDOMServer from 'react-dom/server'
import Globe, { GlobeMethods } from 'react-globe.gl'
import * as THREE from 'three'
import useGlobeControls from '@/lib/globe/useGlobeControls'
import useGlobeSize from '@/lib/globe/useGlobeSize'
import CitizenPointLabel from './CitizenPointLabel'
import CitizenPointModal from './CitizenPointModal'

type EarthProps = {
  pointsData: any[]
  enableControls?: boolean
  enableZoom?: boolean
  rotateOnMouseMove?: boolean
  rotationFactor?: number
  globeBrightness?: number
  showPointLabels?: boolean
}

export default function Earth({
  pointsData,
  enableControls = true,
  enableZoom = true,
  rotateOnMouseMove,
  rotationFactor,
  globeBrightness = 5.5,
  showPointLabels = true,
}: EarthProps) {
  const size = useGlobeSize()
  const globeRef = useRef<GlobeMethods | undefined>()
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [pointModalEnabled, setPointModalEnabled] = useState(false)

  useGlobeControls(
    globeRef,
    size,
    enableControls,
    enableZoom,
    rotateOnMouseMove,
    rotationFactor
  )

  //Set iniial POV of Earth to USA
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({
        lat: 39.8283,
        lng: -98.5795,
        altitude: 2,
      })

      console.log(globeRef.current.scene().children[2])

      globeRef.current.lights().forEach((light) => {
        light.intensity = globeBrightness
      })
    }
  }, [])

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
          showPointLabels
            ? ReactDOMServer.renderToString(
                <CitizenPointLabel
                  formattedAddress={d.formattedAddress}
                  citizens={d.citizens}
                />
              )
            : `<></>`
        }
        onPointClick={(d: any) => {
          if (showPointLabels) {
            setSelectedPoint(d)
            setPointModalEnabled(true)
          }
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
