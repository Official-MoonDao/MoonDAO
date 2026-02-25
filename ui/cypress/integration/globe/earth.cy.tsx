// WebGL-based components like Earth (using react-globe.gl) cannot be reliably
// tested in Cypress component tests due to headless browser limitations.
// This test verifies the module structure is correct. Full rendering should
// be tested in E2E tests with real browsers that support WebGL.
describe('<Earth />', () => {
  it('Earth module can be imported', () => {
    // Dynamic import to test module loading
    cy.wrap(import('@/components/globe/Earth')).should((module: any) => {
      expect(module).to.have.property('default')
      // Earth is exported as memo(Earth, ...) which returns an object, not a function
      // We just verify it exists and is truthy (valid React component)
      expect(module.default).to.exist
    })
  })
})
