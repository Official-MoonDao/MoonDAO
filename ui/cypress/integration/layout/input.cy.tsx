import React from 'react'
import Input from '../../../components/layout/Input'

describe('<Input />', () => {
  it('Renders text input with default props', () => {
    cy.mount(<Input placeholder="Enter text" />)
    cy.get('input[type="text"]').should('exist')
  })

  it('Renders with value', () => {
    cy.mount(<Input value="Test value" onChange={() => {}} />)
    cy.get('input').should('have.value', 'Test value')
  })

  it('Renders with label', () => {
    cy.mount(<Input label="Username" placeholder="Enter username" />)
    cy.contains('Username').should('exist')
  })

  it('Handles onChange event', () => {
    const onChange = cy.stub()
    cy.mount(<Input onChange={onChange} />)
    cy.get('input').type('test')
    cy.wrap(onChange).should('have.been.called')
  })

  it('Renders disabled input', () => {
    cy.mount(<Input disabled placeholder="Disabled" />)
    cy.get('input').should('be.disabled')
  })

  it('Renders with placeholder', () => {
    cy.mount(<Input placeholder="Enter your name" />)
    cy.get('input').should('have.attr', 'placeholder', 'Enter your name')
  })

  it('Renders with error message', () => {
    cy.mount(<Input error="This field is required" />)
    cy.contains('This field is required').should('exist')
    cy.get('input').should('have.class', 'border-red-500')
  })

  it('Renders with maxLength', () => {
    cy.mount(<Input maxLength={10} />)
    cy.get('input').should('have.attr', 'maxLength', '10')
  })

  it('Renders textarea when type is textarea', () => {
    cy.mount(<Input type="textarea" placeholder="Enter message" />)
    cy.get('textarea').should('exist')
  })

  it('Renders textarea with rows', () => {
    cy.mount(<Input type="textarea" rows={5} />)
    cy.get('textarea').should('have.attr', 'rows', '5')
  })

  it('Renders with standard variant', () => {
    cy.mount(<Input variant="standard" />)
    cy.get('input').should('exist')
  })

  it('Renders with modern variant', () => {
    cy.mount(<Input variant="modern" label="Modern Input" />)
    cy.contains('Modern Input').should('exist')
  })

  it('Renders with dark variant', () => {
    cy.mount(<Input variant="dark" />)
    cy.get('input').should('exist')
  })

  it('Renders with small size', () => {
    cy.mount(<Input size="sm" />)
    cy.get('input').should('exist')
  })

  it('Renders with medium size', () => {
    cy.mount(<Input size="md" />)
    cy.get('input').should('exist')
  })

  it('Renders with large size', () => {
    cy.mount(<Input size="lg" />)
    cy.get('input').should('exist')
  })

  it('Renders with icon', () => {
    cy.mount(<Input icon={<span data-testid="icon">🔍</span>} />)
    cy.get('[data-testid="icon"]').should('exist')
  })

  it('Renders with extra content', () => {
    cy.mount(<Input extra={<span data-testid="extra">$</span>} />)
    cy.get('[data-testid="extra"]').should('exist')
  })

  it('Renders number input', () => {
    cy.mount(<Input type="number" placeholder="Enter number" formatNumbers={false} />)
    cy.get('input[type="number"]').should('exist')
  })

  it('Renders number input with formatting (converts to text)', () => {
    cy.mount(<Input type="number" placeholder="Enter number" formatNumbers={true} />)
    cy.get('input[type="text"]').should('exist')
  })

  it('Renders email input', () => {
    cy.mount(<Input type="email" placeholder="Enter email" />)
    cy.get('input[type="email"]').should('exist')
  })

  it('Renders password input', () => {
    cy.mount(<Input type="password" placeholder="Enter password" />)
    cy.get('input[type="password"]').should('exist')
  })

  it('Renders date input', () => {
    cy.mount(<Input type="date" />)
    cy.get('input[type="date"]').should('exist')
  })

  it('Renders date input with min and max', () => {
    cy.mount(<Input type="date" min="2024-01-01" max="2024-12-31" />)
    cy.get('input[type="date"]')
      .should('have.attr', 'min', '2024-01-01')
      .and('have.attr', 'max', '2024-12-31')
  })

  it('Handles onBlur event', () => {
    const onBlur = cy.stub()
    cy.mount(<Input onBlur={onBlur} />)
    cy.get('input').focus().blur()
    cy.wrap(onBlur).should('have.been.calledOnce')
  })

  it('Applies custom className', () => {
    cy.mount(<Input className="custom-input" />)
    cy.get('input').should('have.class', 'custom-input')
  })

  it('Renders with custom maxWidth', () => {
    cy.mount(<Input maxWidth="max-w-[500px]" />)
    cy.get('[data-cy="input-wrapper"]').should('have.class', 'max-w-[500px]')
  })
})
