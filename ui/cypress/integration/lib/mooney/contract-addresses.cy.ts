import {
  SUPPORTED_CHAINS,
  getMooneyAddress,
  getChainAddressInfo,
  getAllChainAddresses,
} from '@/lib/mooney/utils/contractAddresses'
import { arbitrum, base, ethereum, polygon } from '@/lib/rpc/chains'

describe('contractAddresses', () => {
  it('exports SUPPORTED_CHAINS array', () => {
    expect(SUPPORTED_CHAINS).to.be.an('array')
    expect(SUPPORTED_CHAINS.length).to.be.greaterThan(0)
  })

  it('SUPPORTED_CHAINS includes expected chains', () => {
    const chainIds = SUPPORTED_CHAINS.map((chain) => chain.id)
    expect(chainIds).to.include(ethereum.id)
    expect(chainIds).to.include(arbitrum.id)
    expect(chainIds).to.include(polygon.id)
    expect(chainIds).to.include(base.id)
  })

  it('getMooneyAddress returns address for supported chain', () => {
    const address = getMooneyAddress(ethereum)
    expect(address).to.be.a('string')
    expect(address).to.match(/^0x[a-fA-F0-9]{40}$/)
  })

  it('getMooneyAddress returns undefined for unsupported chain', () => {
    const unsupportedChain = { ...ethereum, id: 999999 }
    const address = getMooneyAddress(unsupportedChain as typeof ethereum)
    expect(address).to.be.undefined
  })

  it('getChainAddressInfo returns info for supported chain', () => {
    const info = getChainAddressInfo(ethereum)
    expect(info).to.not.be.null
    if (info) {
      expect(info).to.have.property('chain')
      expect(info).to.have.property('address')
      expect(info).to.have.property('chainName')
      expect(info).to.have.property('color')
      expect(info.address).to.match(/^0x[a-fA-F0-9]{40}$/)
    }
  })

  it('getAllChainAddresses returns array of chain info', () => {
    const addresses = getAllChainAddresses()
    expect(addresses).to.be.an('array')
    expect(addresses.length).to.be.greaterThan(0)
    addresses.forEach((info) => {
      expect(info).to.have.property('chain')
      expect(info).to.have.property('address')
      expect(info).to.have.property('chainName')
      expect(info).to.have.property('color')
    })
  })
})

