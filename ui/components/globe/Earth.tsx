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
  globeBrightness = 9,
  showPointLabels = true,
}: EarthProps) {
  const { width: size } = useGlobeSize()
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

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({
        lat: 39.8283,
        lng: -98.5795,
        altitude: 2,
      })

      // Get all lights
      const lights = globeRef.current.lights()
      
      // Set intensity for both lights
      lights.forEach((light) => {
        light.intensity = globeBrightness
        
        // Change only the DirectionalLight color
        if (light.type === 'DirectionalLight') {
          light.color = new THREE.Color('#3644A6')
        }
      })
    }
  }, [])

  return (
    <>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Globe
          ref={globeRef}
          width={size}
          height={size}
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
      </div>
      {pointModalEnabled && (
        <CitizenPointModal
          selectedPoint={selectedPoint}
          setEnabled={setPointModalEnabled}
        />
      )}
    </>
  )
}
