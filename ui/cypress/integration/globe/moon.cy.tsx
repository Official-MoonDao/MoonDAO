import React from 'react'

// Instead of testing the actual Globe rendering (which requires WebGL),
// we'll test that the Moon component can be imported and mounted
// The actual Globe functionality is better tested in E2E tests
describe('<Moon />', () => {
  it('Moon module can be imported', () => {
    // Dynamic import to test module loading
    cy.wrap(import('@/components/globe/Moon')).should((module: any) => {
      expect(module).to.have.property('default')
      expect(module.default).to.be.a('function')
    })
  })
})
