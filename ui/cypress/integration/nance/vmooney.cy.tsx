import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'

describe('fetchTotalVMOONEYs', () => {
  it('returns vMOONEY balances for addresses at timestamp', () => {
    if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET) {
      cy.log('Skipping test: NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET not set')
      return
    }
    const ADDRESSES = [
      '0x08B3e694caA2F1fcF8eF71095CED1326f3454B89',
      '0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6',
    ]
    const TIMESTAMP = 1764016844

    cy.wrap(fetchTotalVMOONEYs(ADDRESSES, TIMESTAMP)).then((vMOONEYs: any) => {
      expect(vMOONEYs).to.be.an('array')
      expect(vMOONEYs).to.have.length(ADDRESSES.length)
      vMOONEYs.forEach((val: number, i: number) => {
        expect(val).to.be.a('number')
        expect(val).to.be.gte(0)
      })
    })
  })
})
