import React from 'react'
import AdaptiveImage from '../../../components/layout/AdaptiveImage'

describe('<AdaptiveImage />', () => {
  it('Renders nothing when src is not provided', () => {
    cy.mount(<AdaptiveImage />)
    cy.get('img').should('not.exist')
  })

  it('Renders fallback when src is not provided and fallback is given', () => {
    cy.mount(
      <AdaptiveImage fallback={<div data-testid="fallback">No image</div>} />
    )
    cy.get('[data-testid="fallback"]').should('exist')
    cy.contains('No image').should('exist')
  })

  it('Renders with string src', () => {
    cy.mount(<AdaptiveImage src="/test-image.png" alt="Test image" />)
    cy.get('img').should('exist')
  })

  it('Renders with alt text', () => {
    cy.mount(<AdaptiveImage src="/test-image.png" alt="Test image" />)
    cy.get('img').should('have.attr', 'alt', 'Test image')
  })

  it('Renders with custom className', () => {
    cy.mount(<AdaptiveImage src="/test-image.png" className="custom-image" />)
    cy.get('img').should('have.class', 'custom-image')
  })

  it('Renders with custom width and height', () => {
    cy.mount(<AdaptiveImage src="/test-image.png" width={300} height={300} />)
    cy.get('img').should('exist')
  })

  it('Renders with blob URL', () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const blobUrl = URL.createObjectURL(file)
    cy.mount(<AdaptiveImage src={blobUrl} alt="Blob image" />)
    cy.get('img').should('exist')
  })

  it('Renders with File object', () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    cy.mount(<AdaptiveImage src={file} alt="File image" />)
    cy.get('img').should('exist')
  })

  it('Renders with default dimensions', () => {
    cy.mount(<AdaptiveImage src="/test-image.png" />)
    cy.get('img').should('exist')
  })
})

