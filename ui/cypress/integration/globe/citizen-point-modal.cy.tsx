import TestnetProviders from '@/cypress/mock/TestnetProviders'
import CitizenPointModal from '@/components/globe/CitizenPointModal'

describe('<CitizenPointModal />', () => {
  let props: any

  beforeEach(() => {
    props = {
      selectedPoint: {
        formattedAddress: '123 Main St, Anytown, USA',
        citizens: [
          {
            id: 1,
            name: 'ryan',
            image:
              'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifh2vwvfxfy6fevqkirldplgp47sfblcfvhn7nsxo4z4krsuulf2e/',
          },
          {
            id: 2,
            name: 'name.get',
            image:
              'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeibo5na6nkatvor7bqisybzwtmh5n4l4wuws3uiyoqvjuuqwzwobna/',
          },
        ],
      },
      setEnabled: cy.stub(),
    }

    cy.mount(
      <TestnetProviders>
        <CitizenPointModal {...props} />
      </TestnetProviders>
    )
  })

  it('Renders the formatted address', () => {
    cy.contains('123 Main St, Anytown, USA').should('exist')
  })

  it('Renders citizen images and names', () => {
    props.selectedPoint.citizens.forEach((citizen: any) => {
      cy.get(`img[alt="${citizen.name}"]`).should('exist')
      cy.contains(citizen.name).should('exist')
    })
  })

  it('Closes the modal when the close button is clicked', () => {
    cy.get('#close-modal').click()
    cy.wrap(props.setEnabled).should('have.been.calledWith', false)
  })
})
