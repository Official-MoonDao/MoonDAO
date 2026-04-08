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

  it('Renders the component with current image', () => {
    cy.get('#teamPic').should('exist')
  })

  it('Displays the current image if provided', () => {
    cy.get('#teamPic').should('exist')
    cy.get('img')
      .should('have.attr', 'src')
      .and('include', '/_next/image?url=https%3A%2F%2Fgray-main-toad-36.mypinata.cloud%2Fipfs%2F%2FOriginal.png')
  })

  it('Displays the uploaded image if provided', () => {
    // Click "Change image" to show the file input
    cy.contains('Change image').should('not.exist')
    // Mount without currImage so upload zone is shown
    cy.mount(
      <TestnetProviders>
        <ImageGenerator
          setImage={cy.stub()}
          nextStage={cy.stub()}
          stage={1}
        />
      </TestnetProviders>
    )
    cy.get('input[type="file"]').attachFile('images/Original.png')
    cy.get('#user-image')
      .should('have.css', 'background-image')
      .and('include', 'blob:')
  })
})
