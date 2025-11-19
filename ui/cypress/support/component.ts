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
  const push = cy.stub().resolves()
  const replace = cy.stub().resolves()
  cy.stub(NextRouter, 'useRouter').returns({ 
    pathname, 
    query: {},
    push, 
    replace 
  })
})

// Add browser polyfills
if (typeof window === 'undefined') {
  global.window = {} as any
}

if (typeof document === 'undefined') {
  global.document = {} as any
}

// Mock browser-specific APIs
if (typeof window.crypto === 'undefined') {
  window.crypto = {
    getRandomValues: (array: any) => array,
  } as any
}

// Add Browser polyfill
const globalAny = global as any
if (typeof globalAny.Browser === 'undefined') {
  globalAny.Browser = {
    detect: () => ({
      name: 'chrome',
      version: '100.0.0',
      os: 'darwin',
    }),
    T: () => ({
      // Mock the T function that Uniswap router expects
      compress: () => new Uint8Array(),
      decompress: () => new Uint8Array(),
    }),
  }
}

// Mock other browser-specific objects
if (typeof globalAny.navigator === 'undefined') {
  globalAny.navigator = {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    language: 'en-US',
  }
}

// Add any other necessary polyfills or mocks here
