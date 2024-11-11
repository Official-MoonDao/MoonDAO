import CitizenPointLabel from '@/components/globe/CitizenPointLabel'

describe('<CitizenPointLabel />', () => {
  let props: any

  beforeEach(() => {
    props = {
      formattedAddress: '123 Main St, Anytown, USA',
      citizens: [
        {
          id: 1,
          name: 'Ryan',
          image:
            'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifh2vwvfxfy6fevqkirldplgp47sfblcfvhn7nsxo4z4krsuulf2e/',
        },
        {
          id: 2,
          name: 'Name.get',
          image:
            'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeibo5na6nkatvor7bqisybzwtmh5n4l4wuws3uiyoqvjuuqwzwobna/',
        },
      ],
    }

    cy.mount(<CitizenPointLabel {...props} />)
  })

  it('Renders the formatted address', () => {
    cy.contains('123 Main St, Anytown, USA').should('exist')
  })

  it('Renders citizen images and names', () => {
    props.citizens.forEach((citizen: any) => {
      cy.get(`img[alt="${citizen.name}"]`).should(
        'have.attr',
        'src',
        citizen.image
      )
      cy.contains(
        citizen.name.length > 10
          ? citizen.name.slice(0, 10) + '...'
          : citizen.name
      ).should('exist')
    })
  })
})
