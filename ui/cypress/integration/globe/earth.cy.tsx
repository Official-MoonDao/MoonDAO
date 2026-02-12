import React from 'react'

// WebGL-based components like Earth (using react-globe.gl) cannot be reliably
// tested in Cypress component tests due to headless browser limitations.
// This test verifies the module structure is correct. Full rendering should
// be tested in E2E tests with real browsers that support WebGL.
describe('<Earth />', () => {
  it('Earth module can be imported', () => {
    // Dynamic import to test module loading
    cy.wrap(import('@/components/globe/Earth')).should((module: { default: React.ComponentType<any> }) => {
      expect(module).to.have.property('default')
      // Check that it's a valid React component (can be an object or function)
      expect(module.default).to.exist
    })
  })
})
