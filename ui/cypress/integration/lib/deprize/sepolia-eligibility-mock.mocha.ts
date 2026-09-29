import fs from 'fs'
import path from 'path'
import { ethers } from 'ethers'
import {
  complianceSignerAddress,
  signCompliancePermit,
} from '@/lib/deprize/compliancePermit'
import { SEPOLIA_CHAIN_ID, shouldMockSepoliaEligibility } from '@/lib/deprize/eligibility'

const UI_ROOT = path.resolve(__dirname, '../../../../')
const TEST_KEY = `0x${'11'.repeat(32)}`
const ARBITRUM_CHAIN_ID = 42161

describe('sepolia eligibility mock', () => {
  const prevEnv = process.env.NEXT_PUBLIC_ENV

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.NEXT_PUBLIC_ENV
    else process.env.NEXT_PUBLIC_ENV = prevEnv
  })

  it('mocks Sepolia outside production and keeps every other chain real', () => {
    process.env.NEXT_PUBLIC_ENV = 'dev'
    expect(shouldMockSepoliaEligibility(SEPOLIA_CHAIN_ID)).to.equal(true)
    expect(shouldMockSepoliaEligibility(ARBITRUM_CHAIN_ID)).to.equal(false)

    process.env.NEXT_PUBLIC_ENV = 'prod'
    expect(shouldMockSepoliaEligibility(SEPOLIA_CHAIN_ID)).to.equal(false)
    expect(shouldMockSepoliaEligibility(ARBITRUM_CHAIN_ID)).to.equal(false)

    const prevVercel = process.env.VERCEL_ENV
    process.env.VERCEL_ENV = 'preview'
    expect(shouldMockSepoliaEligibility(SEPOLIA_CHAIN_ID)).to.equal(true)
    expect(shouldMockSepoliaEligibility(ARBITRUM_CHAIN_ID)).to.equal(false)
    if (prevVercel === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = prevVercel
  })

  it('signs a permit without importing viem/accounts', async () => {
    const src = fs.readFileSync(path.join(UI_ROOT, 'lib/deprize/compliancePermit.ts'), 'utf8')
    expect(src).to.not.include("from 'viem/accounts'")
    const modal = fs.readFileSync(path.join(UI_ROOT, 'components/deprize/BetModal.tsx'), 'utf8')
    expect(modal).to.include('shouldMockSepoliaEligibility')
    expect(modal).to.include('readApiJson')

    const prevKey = process.env.DEPRIZE_COMPLIANCE_SIGNER_KEY
    process.env.DEPRIZE_COMPLIANCE_SIGNER_KEY = TEST_KEY
    try {
      const wallet = '0x69864c02847ca377458fa6e20ffe378cc2e5140b'
      const mintAddress = '0x22E22C4135be93595f341e072321D18e7D4Ee0D0'
      const deadline = 1893456000n
      const signature = await signCompliancePermit({
        wallet: wallet as `0x${string}`,
        deprizeId: 2n,
        deadline,
        chainId: SEPOLIA_CHAIN_ID,
        mintAddress: mintAddress as `0x${string}`,
      })
      expect(signature).to.match(/^0x[0-9a-fA-F]{130}$/)
      const recovered = ethers.utils.verifyTypedData(
        {
          name: 'DePrizeMint',
          version: '1',
          chainId: SEPOLIA_CHAIN_ID,
          verifyingContract: mintAddress,
        },
        {
          CompliancePermit: [
            { name: 'wallet', type: 'address' },
            { name: 'deprizeId', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        { wallet, deprizeId: 2n, deadline },
        signature
      )
      expect(recovered).to.equal(complianceSignerAddress())
    } finally {
      if (prevKey === undefined) delete process.env.DEPRIZE_COMPLIANCE_SIGNER_KEY
      else process.env.DEPRIZE_COMPLIANCE_SIGNER_KEY = prevKey
    }
  })
})
