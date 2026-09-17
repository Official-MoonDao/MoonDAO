import {
  buildCitizenOwnerLookupStatement,
  citizenRowsByOwner,
  isLikelyEthAddress,
} from '@/lib/citizen/citizenLookup'

const ALICE = '0x1111111111111111111111111111111111111111'
const BOB = '0x2222222222222222222222222222222222222222'

describe('citizen owner lookup', () => {
  it('builds a Tableland IN query and maps rows by owner', () => {
    const statement = buildCitizenOwnerLookupStatement('arbitrum', [ALICE, BOB, 'not-an-address'])
    expect(statement).to.include('LOWER(owner) IN')
    expect(statement).to.include(ALICE)
    expect(statement).to.include(BOB)
    expect(statement).to.not.include('not-an-address')
    expect(isLikelyEthAddress(ALICE)).to.equal(true)
    expect(isLikelyEthAddress('0x123')).to.equal(false)

    const map = citizenRowsByOwner([
      { id: 1, name: 'Ada', owner: ALICE.toUpperCase(), image: null },
    ])
    expect(map.get(ALICE)?.name).to.equal('Ada')
  })

  it('returns null when the chain has no citizen table or no addresses', () => {
    expect(buildCitizenOwnerLookupStatement('unknown-chain', [ALICE])).to.equal(null)
    expect(buildCitizenOwnerLookupStatement('arbitrum', [])).to.equal(null)
  })
})
