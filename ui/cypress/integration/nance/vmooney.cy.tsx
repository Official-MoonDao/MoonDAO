import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
describe('fetchTotalVMOONEYs', () => {
  it('one address', async () => {
    const vMOONEYs = await fetchTotalVMOONEYs(
      ['0x08B3e694caA2F1fcF8eF71095CED1326f3454B89', '0x2eb09037de144d7bdf2af06130def727a239f8cd'],
      1764016844
    )
    expect(vMOONEYs[0]).to.equal(15065276.937865206)
    expect(vMOONEYs[1]).to.equal(210646.89348854357)
  })
})
