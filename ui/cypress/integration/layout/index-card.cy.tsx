import IndexCard from '@/components/layout/IndexCard'

describe('<IndexCard />', () => {
  let props: any

  beforeEach(() => {
    props = {
      icon: '/assets/icon-passport.svg',
      iconAlt: 'Custom Icon',
      header: 'Test Header',
      paragraph: <p>Test Paragraph</p>,
      link: '/',
      hovertext: 'Hover Text',
      metadata: {
        name: 'Test Name',
        description: 'Test Description',
        id: '123',
        attributes: [{ trait_type: 'discord', value: 'testDiscord' }],
      },
      onClick: cy.stub(),
    }
    cy.mountNextRouter('/')
    cy.mount(<IndexCard {...props} />)
  })

  it('Renders with default props', () => {
    cy.get('#index-featured-icon').should(
      'have.attr',
      'src',
      '/assets/icon-passport.svg'
    )
    // Header can contain both header and metadata.name
    cy.get('#index-main-header').should('exist')
    // Check that header text is present (may be combined with metadata.name)
    cy.get('#index-main-header').should('contain.text', props.header || props.metadata.name)
  })

  it('Renders with provided props', () => {
    cy.get('#index-featured-icon').should('have.attr', 'src', props.icon)
    cy.get('#index-main-header').should('contain.text', props.header)
    cy.get('#index-description-and-id-container').should(
      'contain.text',
      props.metadata.description
    )
    cy.get('#index-handle-container').should(
      'contain.text',
      `Discord: @${props.metadata.attributes[0].value}`
    )
  })

  it('Navigates to link on click', () => {
    cy.get('#index-card-link').click()
    cy.url().should('include', props.link)
  })

  it('Calls onClick function when provided', () => {
    cy.get('#index-card-link').click()
    cy.wrap(props.onClick).should('have.been.calledOnce')
  })
})
