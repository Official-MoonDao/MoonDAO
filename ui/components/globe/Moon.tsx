import { useEffect, useRef } from 'react'
import Globe, { GlobeMethods } from 'react-globe.gl'
import useGlobeSize from '@/lib/globe/useGlobeSize'
import MOON_LANDINGS from '../../public/react-globe/moon_landings.json'

export default function Moon() {
  const size = useGlobeSize()
  const globeRef = useRef<GlobeMethods | undefined>()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (globeRef.current) {
        // Enable damping for smoother rotation with inertia
        const controls = globeRef.current.controls()
        if (controls) {
          controls.enableDamping = true
          controls.dampingFactor = 0.02
        }
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])

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
      labelsData={MOON_LANDINGS}
      labelColor="#000000"
      animateIn
    />
  )
}
