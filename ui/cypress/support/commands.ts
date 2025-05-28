import 'cypress-file-upload'

/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

declare global {
  namespace Cypress {
    interface Chainable {
      loginWithPrivy(): Chainable<void>
    }
  }
}

//Mute XHR & Fetch requests
Cypress.on('log:changed', (log, interactive) => {
  if (log.displayName !== 'fetch') return
  const windo: any = window
  const logs = windo?.top.document.querySelectorAll('li.command-name-request')
  if (logs.length) {
    const last = [...logs][logs.length - 1]
    last.remove()
  }
})

Cypress.on('uncaught:exception', (err, runnable) => {
  if (err.message.includes('noNetwork')) {
    return false
  }
})

Cypress.Commands.add('loginWithPrivy', () => {
  // Click the sign in button
  cy.get('#sign-in-button').click({ force: true })

  // Wait for Privy modal to appear
  cy.get('#privy-modal-content').should('exist')

  // Click the SMS login option
  cy.contains('Continue with SMS').click()

  // Type in phone number
  cy.get('input[type="tel"]').type(Cypress.env('NEXT_PUBLIC_PRIVY_TEST_PHONE'))

  // Click submit
  cy.contains('Submit').click()

  // Wait for verification code inputs
  cy.get('input[type="text"]').should('have.length', 6)

  // Type verification code into each input field
  const otp = Cypress.env('NEXT_PUBLIC_PRIVY_TEST_OTP')
  cy.get('input[type="text"]').each(($input, index) => {
    cy.wrap($input).type(otp[index])
  })
})
