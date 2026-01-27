import Globe from 'react-globe.gl'
import useGlobeSize from '@/lib/globe/useGlobeSize'
import MOON_LANDINGS from '../../../public/react-globe/moon_landings.json'

// Test wrapper that exposes onGlobeReady for test synchronization
function TestMoon({ onReady }: { onReady?: () => void }) {
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
      onGlobeReady={onReady}
    />
  )
}

describe('<Moon />', () => {
  it('Renders component with canvas', () => {
    // Use a ref to track when globe is ready
    let globeReady = false
    const onReady = () => {
      globeReady = true
    }

    cy.mount(<TestMoon onReady={onReady} />)

    // Wait for globe to be ready (WebGL initialized, textures loaded)
    cy.wrap(null, { timeout: 15000 }).should(() => {
      expect(globeReady).to.be.true
    })

    // Canvas should now exist
    cy.get('canvas').should('exist')
  })
})
