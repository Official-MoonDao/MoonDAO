import { ethers } from 'ethers'
import {
  encodeContractCall,
  isAddressInList,
  safeTransactionUrl,
} from '@/lib/deprize/safeProposal'

const PABLO = '0x679d87D8640e66778c3419D164998E720D7495f6'
const RYAN = '0xB2d3900807094D4Fe47405871B0C8AdB58E10D42'
const SAFE = '0xE5148e4399e3D849F629E0FECEcf6fC986e96127'

describe('deprize safe proposal', () => {
  it('treats any Safe owner as an executive signer', () => {
    const owners = [PABLO, RYAN]
    expect(isAddressInList(PABLO.toLowerCase(), owners)).to.equal(true)
    expect(isAddressInList(RYAN, owners)).to.equal(true)
    expect(isAddressInList('0x0000000000000000000000000000000000000001', owners)).to.equal(
      false
    )
    expect(isAddressInList(undefined, owners)).to.equal(false)
  })

  it('builds a Sepolia Safe link others can open to sign', () => {
    const hash = '0x' + 'ab'.repeat(32)
    expect(safeTransactionUrl(11155111, SAFE.toLowerCase(), hash)).to.equal(
      `https://app.safe.global/transactions/tx?safe=sep:${SAFE}&id=multisig_${SAFE}_${hash}`
    )
  })

  it('encodes a registry call the Safe can execute', () => {
    const data = encodeContractCall(['function lock(uint256 deprizeId)'], 'lock', [7n])
    const iface = new ethers.utils.Interface(['function lock(uint256 deprizeId)'])
    expect(data).to.equal(iface.encodeFunctionData('lock', [7]))
  })
})
