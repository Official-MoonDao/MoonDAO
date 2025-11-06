import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react'
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

function Earth({ pointsData, width, height }: EarthProps) {
  const defaultSize = useGlobeSize()
  const size = useMemo(
    () => (width && height ? { width, height } : defaultSize),
    [width, height, defaultSize]
  )
  const globeRef = useRef<GlobeMethods | undefined>()
  const pointsDataRef = useRef<any[]>(pointsData)
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [pointModalEnabled, setPointModalEnabled] = useState(false)

  const memoizedPointsData = useMemo(() => {
    if (
      pointsDataRef.current.length !== pointsData.length ||
      pointsDataRef.current !== pointsData
    ) {
      pointsDataRef.current = pointsData
    }
    return pointsDataRef.current
  }, [pointsData])

  const pointLabel = useCallback(
    (d: any) =>
      ReactDOMServer.renderToString(
        <CitizenPointLabel
          formattedAddress={d.formattedAddress}
          citizens={d.citizens}
        />
      ),
    []
  )

  const handlePointClick = useCallback((d: any) => {
    setSelectedPoint(d)
    setPointModalEnabled(true)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (globeRef.current) {
        globeRef.current.pointOfView({
          lat: 39.8283,
          lng: -98.5795,
          altitude: 3.5,
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor="#00000000"
        globeImageUrl={'/react-globe/earth-night.jpg'}
        pointsData={memoizedPointsData}
        pointAltitude="size"
        pointColor="color"
        pointRadius={0.5}
        labelSize={1.7}
        pointLabel={pointLabel}
        onPointClick={handlePointClick}
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

export default memo(Earth, (prevProps, nextProps) => {
  if (prevProps.pointsData.length !== nextProps.pointsData.length) {
    return false
  }
  if (
    prevProps.width !== nextProps.width ||
    prevProps.height !== nextProps.height
  ) {
    return false
  }
  return true
})
