// ***********************************************************
// This example support/component.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************
// Import commands.js using ES2015 syntax:
// Alternatively you can use CommonJS syntax:
// require('./commands')
import { mount } from 'cypress/react18'
import * as NextRouter from 'next/router'
import './commands'

// Augment the Cypress namespace to include type definitions for
// your custom command.
// Alternatively, can be defined in cypress/support/component.d.ts
// with a <reference path="./component" /> at the top of your spec.
type GetById = {
  (id: string): Cypress.Chainable<JQuery<HTMLElement>>
}

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
      getById: GetById
      mountNextRouter: (pathname: string) => void
    }
  }
}

Cypress.Commands.add('mount', mount)
// Example use:
// cy.mount(<MyComponent />)

Cypress.Commands.add('getById', (input: any) => {
  cy.get(`[data-cy=${input}]`)
})
// Example use:
// React: <div data-cy="my-id" />
// Cypress: cy.getById('my-id')

//mock next router
Cypress.Commands.add('mountNextRouter', (pathname: string) => {
  const push = cy.stub()
  cy.stub(NextRouter, 'useRouter').returns({ pathname, push })
})
