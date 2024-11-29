import { MutableRefObject, useEffect } from 'react'
import { GlobeMethods } from 'react-globe.gl'

export default function useGlobeControls(
  globeRef: MutableRefObject<GlobeMethods | undefined>,
  size: { width: number; height: number },
  enableControls: boolean = true,
  enableZoom: boolean = true,
  rotateOnMouseMove: boolean = false,
  rotationFactor: number = 1
) {
  //Zoom & Controls
  useEffect(() => {
    if (globeRef?.current) {
      globeRef.current.controls().enableZoom = enableZoom
      globeRef.current.controls().enableRotate = enableControls
      globeRef.current.controls().enablePan = enableControls
    }
  }, [globeRef, enableControls, enableZoom])

  //Rotate on Mouse Move
  useEffect(() => {
    function rotateGlobeOnMouseMove(e: any) {
      const mouseX = e.clientX
      const mouseY = e.clientY
      // Calculate the position relative to the center of the screen
      const centerX = size.width / 2
      const centerY = size.height / 2
      // Convert to -1 to 1 range and apply rotation speed
      const normalizedX = ((-mouseX - centerX) / centerX) * rotationFactor
      const normalizedY = ((mouseY - centerY) / centerY) * rotationFactor
      // Convert to lat/lng (-90 to 90 for lat, -180 to 180 for lng)
      const lat = normalizedY * 90
      const lng = normalizedX * 180
      globeRef.current?.pointOfView({ lat, lng })
    }

    if (rotateOnMouseMove && globeRef?.current) {
      window.addEventListener('mousemove', rotateGlobeOnMouseMove)
    } else {
      window.removeEventListener('mousemove', rotateGlobeOnMouseMove)
    }

    return () => {
      window.removeEventListener('mousemove', rotateGlobeOnMouseMove)
    }
  }, [globeRef, rotateOnMouseMove, rotationFactor, size])
}
