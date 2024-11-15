import Globe from 'react-globe.gl'
import useGlobeSize from '@/lib/globe/useGlobeSize'
import MOON_LANDINGS from '../../public/react-globe/moon_landings.json'

export default function Moon() {
  const size = useGlobeSize()

  return (
    <Globe
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
