import React from 'react'
import ModalHeader from '../../../components/layout/ModalHeader'

describe('<ModalHeader />', () => {
  it('Renders with title', () => {
    cy.mount(<ModalHeader title="Test Modal" />)
    cy.contains('Test Modal').should('exist')
  })

  it('Renders with title and subtitle', () => {
    cy.mount(<ModalHeader title="Test Modal" subtitle="This is a subtitle" />)
    cy.contains('Test Modal').should('exist')
    cy.contains('This is a subtitle').should('exist')
  })

  it('Renders with icon', () => {
    cy.mount(
      <ModalHeader
        title="Test Modal"
        icon={<span data-testid="modal-icon">🚀</span>}
      />
    )
    cy.get('[data-testid="modal-icon"]').should('exist')
  })

  it('Renders close button when onClose is provided', () => {
    const onClose = cy.stub()
    cy.mount(<ModalHeader title="Test Modal" onClose={onClose} />)
    cy.get('[data-testid="modal-header-close"]').should('exist')
  })

  it('Calls onClose when close button is clicked', () => {
    const onClose = cy.stub()
    cy.mount(<ModalHeader title="Test Modal" onClose={onClose} />)
    cy.get('[data-testid="modal-header-close"]').click()
    cy.wrap(onClose).should('have.been.calledOnce')
  })

  it('Renders close button when setEnabled is provided', () => {
    const setEnabled = cy.stub()
    cy.mount(<ModalHeader title="Test Modal" setEnabled={setEnabled} />)
    cy.get('[data-testid="modal-header-close"]').should('exist')
  })

  it('Calls setEnabled with false when close button is clicked', () => {
    const setEnabled = cy.stub()
    cy.mount(<ModalHeader title="Test Modal" setEnabled={setEnabled} />)
    cy.get('[data-testid="modal-header-close"]').click()
    cy.wrap(setEnabled).should('have.been.calledWith', false)
  })

  it('Does not render close button when neither onClose nor setEnabled is provided', () => {
    cy.mount(<ModalHeader title="Test Modal" />)
    cy.get('[data-testid="modal-header-close"]').should('not.exist')
  })

  it('Renders with custom className', () => {
    cy.mount(<ModalHeader title="Test Modal" className="custom-class" />)
    cy.get('[data-testid="modal-header"]').should('have.class', 'custom-class')
  })

  it('Renders with custom dataTestId', () => {
    cy.mount(
      <ModalHeader title="Test Modal" dataTestId="custom-modal-header" />
    )
    cy.get('[data-testid="custom-modal-header"]').should('exist')
    cy.get('[data-testid="custom-modal-header-title"]').should('exist')
  })

  it('Renders with all props', () => {
    const onClose = cy.stub()
    cy.mount(
      <ModalHeader
        title="Complete Modal"
        subtitle="With all features"
        icon={<span data-testid="icon">📝</span>}
        onClose={onClose}
        className="custom-header"
        dataTestId="complete-header"
      />
    )
    cy.contains('Complete Modal').should('exist')
    cy.contains('With all features').should('exist')
    cy.get('[data-testid="icon"]').should('exist')
    cy.get('[data-testid="complete-header-close"]').should('exist')
    cy.get('[data-testid="complete-header"]').should('have.class', 'custom-header')
  })
})

