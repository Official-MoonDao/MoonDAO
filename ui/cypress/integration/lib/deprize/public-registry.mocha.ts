import {
  DEPRIZE_EVENTS_FROM_BLOCK,
  DEPRIZE_MINT_ADDRESSES,
  DEPRIZE_REGISTRY_ADDRESSES,
} from 'const/config'

const PUBLIC_REGISTRY = '0x5620749d0579ff08D0DD2389CF9040523DD7B8ea'
const PREVIOUS_REGISTRY = '0xf8B2244634c6eCeF32de10BFe0D7436413A59924'
const PUBLIC_MINT = '0x1D58652aC8dF5dDc762F0D2b531BA3f178f67765'
const PUBLIC_FROM_BLOCK = 518890846
const SEPOLIA_REGISTRY = '0x342fC1Ab7CAcc71d13274D3979EAE17Cf8e93555'
const SEPOLIA_FROM_BLOCK = 12008593

describe('public Arbitrum Touchdown registry', () => {
  it('points Arbitrum at the public registry, mint, and deploy block', () => {
    expect(DEPRIZE_REGISTRY_ADDRESSES.arbitrum).to.equal(PUBLIC_REGISTRY)
    expect(DEPRIZE_REGISTRY_ADDRESSES.arbitrum).to.not.equal(PREVIOUS_REGISTRY)
    expect(DEPRIZE_MINT_ADDRESSES.arbitrum).to.equal(PUBLIC_MINT)
    expect(DEPRIZE_EVENTS_FROM_BLOCK.arbitrum).to.equal(PUBLIC_FROM_BLOCK)
  })

  it('leaves the Sepolia registry and deploy block unchanged', () => {
    expect(DEPRIZE_REGISTRY_ADDRESSES.sepolia).to.equal(SEPOLIA_REGISTRY)
    expect(DEPRIZE_EVENTS_FROM_BLOCK.sepolia).to.equal(SEPOLIA_FROM_BLOCK)
  })
})
