import { useRef } from 'react'
import Globe, { GlobeMethods } from 'react-globe.gl'
import useGlobeControls from '@/lib/globe/useGlobeControls'
import useGlobeSize from '@/lib/globe/useGlobeSize'
import MOON_LANDINGS from '../../public/react-globe/moon_landings.json'

interface MoonProps {
  showMoonLandings?: boolean
  enableZoom?: boolean
  enableControls?: boolean
  rotateOnMouseMove?: boolean
  rotationFactor?: number
}

export default function Moon({
  showMoonLandings,
  enableZoom,
  enableControls,
  rotateOnMouseMove,
  rotationFactor,
}: MoonProps) {
  const size = useGlobeSize()
  const globeRef = useRef<GlobeMethods | undefined>()
  useGlobeControls({
    globeRef,
    size,
    enableControls,
    enableZoom,
    rotateOnMouseMove,
    rotationFactor,
  })

  return (
    <Globe
      ref={globeRef}
      width={size.width}
      height={size.height}
      backgroundColor="#00000000"
      globeImageUrl={'/react-globe/lunar_surface.jpg'}
      bumpImageUrl={'/react-globe/lunar_bumpmap.jpg'}
      showGraticules={false}
      showAtmosphere={false}
      labelText="label"
      labelSize={1.25}
      labelDotRadius={0.4}
      labelsData={showMoonLandings ? MOON_LANDINGS : []}
      labelColor="#000000"
      animateIn
    />
  )
}
