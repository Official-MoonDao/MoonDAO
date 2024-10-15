import { ImageGenerator } from '@/components/onboarding/CitizenImageGenerator'

describe('<CitizenImageGenerator />', () => {
  let props: any

  beforeEach(() => {
    props = {
      currImage: null,
      image: null,
      setImage: cy.stub(),
      inputImage: null,
      setInputImage: cy.stub(),
      nextStage: cy.stub(),
      generateInBG: false,
    }

    cy.mount(<ImageGenerator {...props} />)
  })

  it('Renders the component', () => {
    cy.get('.animate-fadeIn').should('exist')
  })

  it('Displays the FileInput component', () => {
    cy.get('input[type="file"]').should('exist')
  })

  it('Handles image generation', () => {
    cy.mount(
      <ImageGenerator
        {...props}
        inputImage={new File([''], 'test.png', { type: 'image/png' })}
      />
    )

    cy.get('button').contains('Generate').click()
    cy.wrap(props.setImage).should('have.been.called')
  })
})
