import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
describe('fetchTotalVMOONEYs', () => {
  it('one address', async () => {
    const vMOONEYs = await fetchTotalVMOONEYs(
      ['0x08B3e694caA2F1fcF8eF71095CED1326f3454B89', '0x679d87d8640e66778c3419d164998e720d7495f6'],
      1764016844
    )
    cy.log('vMOONEYs')
    cy.log(vMOONEYs)
    //expect(vMOONEYs[0]).to.equal(1.5065276937865206e25)
    expect(vMOONEYs[1]).to.equal(1.5065276937865206e25)
  })
})
