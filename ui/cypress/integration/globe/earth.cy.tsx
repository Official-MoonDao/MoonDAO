import Globe from 'react-globe.gl'
import useGlobeSize from '@/lib/globe/useGlobeSize'

// Test wrapper that exposes onGlobeReady for test synchronization
function TestEarth({ onReady }: { onReady?: () => void }) {
  const size = useGlobeSize()
  return (
    <Globe
      width={size.width}
      height={size.height}
      backgroundColor="#00000000"
      globeImageUrl={'/react-globe/earth-night.jpg'}
      pointsData={[]}
      onGlobeReady={onReady}
    />
  )
}

describe('<Earth />', () => {
  it('Renders component with canvas', () => {
    // Use a ref to track when globe is ready
    let globeReady = false
    const onReady = () => {
      globeReady = true
    }

    cy.mount(<TestEarth onReady={onReady} />)

    // Wait for globe to be ready (WebGL initialized, textures loaded)
    cy.wrap(null, { timeout: 15000 }).should(() => {
      expect(globeReady).to.be.true
    })

    // Canvas should now exist
    cy.get('canvas').should('exist')
  })
})
