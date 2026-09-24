import { tablelandQueryEndpoint } from '@/lib/tableland/endpoint'

describe('tableland query endpoint', () => {
  it('reads a Sepolia table from the testnet gateway', () => {
    expect(tablelandQueryEndpoint(11155111)).to.equal(
      'https://testnets.tableland.network/api/v1/query'
    )
  })

  it('reads an Arbitrum table from the mainnet gateway', () => {
    expect(tablelandQueryEndpoint(42161)).to.equal('https://tableland.network/api/v1/query')
    expect(tablelandQueryEndpoint(1)).to.equal('https://tableland.network/api/v1/query')
  })
})
