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
    // Mount without currImage so the upload zone (file input) is shown.
    // "Change image" only appears after an image has been selected, so it
    // must not exist in this initial empty state.
    cy.mount(
      <TestnetProviders>
        <ImageGenerator
          setImage={cy.stub()}
          nextStage={cy.stub()}
          stage={1}
        />
      </TestnetProviders>
    )
    cy.contains('Change image').should('not.exist')
    cy.get('input[type="file"]').attachFile('images/Original.png')
    // After uploading, the preview renders the uploaded image as a blob
    cy.get('#user-image')
      .should('have.css', 'background-image')
      .and('include', 'blob:')
    // ...and the "Change image" control now appears
    cy.contains('Change image').should('exist')
  })
})
