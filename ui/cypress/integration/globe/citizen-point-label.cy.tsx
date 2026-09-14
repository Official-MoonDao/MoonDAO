import { IPFS_GATEWAY } from 'const/config'
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
            'ipfs://bafybeifh2vwvfxfy6fevqkirldplgp47sfblcfvhn7nsxo4z4krsuulf2e',
        },
        {
          id: 2,
          name: 'Name.get',
          image:
            'ipfs://bafybeibo5na6nkatvor7bqisybzwtmh5n4l4wuws3uiyoqvjuuqwzwobna',
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
      cy.get(`img[alt="${citizen.name}"]`).should('exist')
      cy.contains(
        citizen.name.length > 10
          ? citizen.name.slice(0, 10) + '...'
          : citizen.name
      ).should('exist')
    })
  })

  it('resolves ipfs:// portraits through the dedicated gateway, not ipfs.io', () => {
    props.citizens.forEach((citizen: any) => {
      const cid = citizen.image.replace('ipfs://', '')
      cy.get(`img[alt="${citizen.name}"]`)
        .invoke('attr', 'src')
        .then((src) => {
          const decoded = decodeURIComponent(src || '')
          expect(decoded).to.include(`${IPFS_GATEWAY}${cid}`)
          expect(decoded).to.not.include('ipfs.io')
        })
    })
  })
})
