import FAQ from '@/components/launchpad/FAQ'

describe('<FAQ />', () => {
  const shortAnswer = 'This is a short answer.'
  const longAnswer =
    'This is a very long answer that should be truncated when the FAQ is not expanded. It needs to be over 100 characters long to test the truncation functionality properly. Adding more text to ensure we hit the limit.'

  it('Should render FAQ with question and answer', () => {
    cy.mount(<FAQ question="Test Question" answer={shortAnswer} />)

    cy.get('#faq-question').should('contain', 'Test Question')
    cy.get('#faq-answer').should('contain', shortAnswer)
  })

  it('Should show plus icon when collapsed and minus when expanded', () => {
    cy.mount(<FAQ question="Test Question" answer={shortAnswer} />)

    // Initially shows plus icon
    cy.get('#faq-plus').should('exist')
    cy.get('#faq-minus').should('not.exist')

    // Click to expand
    cy.get('#faq-toggle').click()

    // Shows minus icon after expanding
    cy.get('#faq-minus').should('exist')
    cy.get('#faq-plus').should('not.exist')
  })

  it('Should truncate long answers when collapsed', () => {
    cy.mount(<FAQ question="Test Question" answer={longAnswer} />)

    // Check if answer is truncated
    cy.get('#faq-answer')
      .should('contain', '...')
      .and('have.text', longAnswer.slice(0, 100) + '...')
  })

  it('Should show full answer when expanded', () => {
    cy.mount(<FAQ question="Test Question" answer={longAnswer} />)

    // Initially truncated
    cy.get('#faq-answer').should('contain', '...')

    // Click to expand
    cy.get('#faq-toggle').click()

    // Should show full answer
    cy.get('#faq-answer')
      .should('not.contain', '...')
      .and('have.text', longAnswer)
  })

  it('Should toggle expansion state on button click', () => {
    cy.mount(<FAQ question="Test Question" answer={longAnswer} />)

    // Initial state
    cy.get('#faq-plus').should('exist')
    cy.get('#faq-answer').should('contain', '...')

    // First click - expand
    cy.get('#faq-toggle').click()
    cy.get('#faq-minus').should('exist')
    cy.get('#faq-answer').should('not.contain', '...')

    // Second click - collapse
    cy.get('#faq-toggle').click()
    cy.get('#faq-plus').should('exist')
    cy.get('#faq-answer').should('contain', '...')
  })

  it('Should not truncate short answers even when collapsed', () => {
    cy.mount(<FAQ question="Test Question" answer={shortAnswer} />)

    cy.get('#faq-answer')
      .should('not.contain', '...')
      .and('have.text', shortAnswer)

    // Verify it stays the same when expanded
    cy.get('#faq-toggle').click()
    cy.get('#faq-answer')
      .should('not.contain', '...')
      .and('have.text', shortAnswer)
  })
})
