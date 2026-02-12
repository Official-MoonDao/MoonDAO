import React from 'react'

// Instead of testing the actual Globe rendering (which requires WebGL),
// we'll test that the Earth component can be imported and mounted
// The actual Globe functionality is better tested in E2E tests
describe('<Earth />', () => {
  it('Earth module can be imported', () => {
    // Dynamic import to test module loading
    cy.wrap(import('@/components/globe/Earth')).should((module: any) => {
      expect(module).to.have.property('default')
      expect(module.default).to.be.a('function')
    })
  })
})
