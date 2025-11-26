import { fetchTotalVMOONEYs } from '@/lib/tokens/hooks/useTotalVMOONEY'
describe('fetchTotalVMOONEYs', () => {
  it('current timestamp', async () => {
    const ADDRESSES = [
      '0x08B3e694caA2F1fcF8eF71095CED1326f3454B89',
      '0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6',
    ]
    const TIMESTAMP = 1764016844
    const vMOONEYs = await fetchTotalVMOONEYs(ADDRESSES, TIMESTAMP)

    expect(vMOONEYs[0]).to.equal(15065276.937865206)
    expect(vMOONEYs[1]).to.equal(13612548.02810334)
  })
})
