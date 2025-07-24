import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { ImageGenerator } from '@/components/onboarding/TeamImageGenerator'

describe('<TeamImageGenerator />', () => {
  let props: any

  beforeEach(() => {
    props = {
      currImage: '/Original.png',
      setImage: cy.stub(),
      nextStage: cy.stub(),
      stage: 1,
    }

    cy.mount(
      <TestnetProviders>
        <ImageGenerator {...props} />
      </TestnetProviders>
    )
  })

  it('Renders the component', () => {
    cy.get('input[type="file"]').should('exist')
  })

  it('Displays the current image if provided', () => {
    cy.get('#teamPic').should('exist')
    cy.get('img').should(
      'have.attr',
      'src',
      '/_next/image?url=https%3A%2F%2Fgray-main-toad-36.mypinata.cloud%2Fipfs%2F%2FOriginal.png&w=828&q=75'
    )
  })

  it('Displays the uploaded image if provided', () => {
    cy.get('input[type="file"]').attachFile('images/Original.png')
    cy.get('#user-image')
      .should('have.css', 'background-image')
      .and('include', 'blob:')
  })

  it('Calls nextStage when the button is clicked', () => {
    cy.get('input[type="file"]').attachFile('images/Original.png')
    cy.contains('Continue with this image').should('exist').click()
    cy.wrap(props.nextStage).should('have.been.called')
  })
})
