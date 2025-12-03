import React from 'react'
import Button from '../../../components/layout/Button'

describe('<Button />', () => {
  it('Renders with default props', () => {
    cy.mount(<Button>Click me</Button>)
    cy.contains('Click me').should('exist')
  })

  it('Renders with primary variant', () => {
    cy.mount(<Button variant="primary">Primary Button</Button>)
    cy.contains('Primary Button').should('exist')
  })

  it('Renders with secondary variant', () => {
    cy.mount(<Button variant="secondary">Secondary Button</Button>)
    cy.contains('Secondary Button').should('exist')
  })

  it('Renders with gradient variant', () => {
    cy.mount(<Button variant="gradient">Gradient Button</Button>)
    cy.contains('Gradient Button').should('exist')
  })

  it('Renders with small size', () => {
    cy.mount(<Button size="sm">Small Button</Button>)
    cy.contains('Small Button').should('exist')
  })

  it('Renders with medium size', () => {
    cy.mount(<Button size="md">Medium Button</Button>)
    cy.contains('Medium Button').should('exist')
  })

  it('Renders with large size', () => {
    cy.mount(<Button size="lg">Large Button</Button>)
    cy.contains('Large Button').should('exist')
  })

  it('Handles click events', () => {
    const onClick = cy.stub()
    cy.mount(<Button onClick={onClick}>Clickable</Button>)
    cy.contains('Clickable').click()
    cy.wrap(onClick).should('have.been.calledOnce')
  })

  it('Renders disabled button', () => {
    cy.mount(<Button disabled>Disabled</Button>)
    cy.contains('Disabled').should('be.disabled')
  })

  it('Renders with custom className', () => {
    cy.mount(<Button className="custom-class">Custom</Button>)
    cy.contains('Custom').should('have.class', 'custom-class')
  })

  it('Renders with icon on left', () => {
    cy.mount(
      <Button icon={<span data-testid="icon">🚀</span>} iconPosition="left">
        With Icon
      </Button>
    )
    cy.get('[data-testid="icon"]').should('exist')
  })

  it('Renders with icon on right', () => {
    cy.mount(
      <Button icon={<span data-testid="icon">🚀</span>} iconPosition="right">
        With Icon
      </Button>
    )
    cy.get('[data-testid="icon"]').should('exist')
  })

  it('Renders with custom border radius', () => {
    cy.mount(<Button borderRadius="rounded-full">Rounded</Button>)
    cy.contains('Rounded').should('have.class', 'rounded-full')
  })

  it('Renders with custom text color', () => {
    cy.mount(<Button textColor="text-blue-500">Blue Text</Button>)
    cy.contains('Blue Text').should('have.class', 'text-blue-500')
  })

  it('Renders submit type button', () => {
    cy.mount(<Button type="submit">Submit</Button>)
    cy.contains('Submit').should('have.attr', 'type', 'submit')
  })

  it('Renders reset type button', () => {
    cy.mount(<Button type="reset">Reset</Button>)
    cy.contains('Reset').should('have.attr', 'type', 'reset')
  })

  it('Does not call onClick when disabled', () => {
    const onClick = cy.stub()
    cy.mount(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    )
    cy.contains('Disabled').click({ force: true })
    cy.wrap(onClick).should('not.have.been.called')
  })
})
