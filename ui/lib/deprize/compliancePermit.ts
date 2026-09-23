import { DEPRIZE_MINT_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import { hashTypedData, type Hex } from 'viem'
import { getChainById, getChainSlug } from '@/lib/thirdweb/chain'

export const COMPLIANCE_PERMIT_TYPES = {
  CompliancePermit: [
    { name: 'wallet', type: 'address' },
    { name: 'deprizeId', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export const DEFAULT_PERMIT_TTL_SECONDS = 2 * 60

export function mintAddressForChain(chainId: number): string {
  const chain = getChainById(chainId)
  if (!chain) return ''
  return DEPRIZE_MINT_ADDRESSES[getChainSlug(chain)] ?? ''
}

export function complianceDomain(chainId: number, mintAddress: Hex) {
  return {
    name: 'DePrizeMint',
    version: '1',
    chainId,
    verifyingContract: mintAddress,
  }
}

function signerKey(): Hex | null {
  const raw = process.env.DEPRIZE_COMPLIANCE_SIGNER_KEY?.trim()
  if (!raw) return null
  const key = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) return null
  return key as Hex
}

export function complianceSignerAddress(): string | null {
  const key = signerKey()
  if (!key) return null
  // ethers, not viem/accounts: that entry loads a bip32 build whose ESM import
  // of @noble/hashes fails under the pinned hashes 1.8.0, and Next then returns
  // an HTML error page for /api/deprize/permit.
  return ethers.utils.computeAddress(key)
}

export async function signCompliancePermit(args: {
  wallet: Hex
  deprizeId: bigint
  deadline: bigint
  chainId: number
  mintAddress: Hex
}): Promise<Hex> {
  const key = signerKey()
  if (!key) throw new Error('DEPRIZE_COMPLIANCE_SIGNER_KEY is not configured')
  const wallet = new ethers.Wallet(key)
  const signature = await wallet._signTypedData(
    complianceDomain(args.chainId, args.mintAddress),
    {
      CompliancePermit: COMPLIANCE_PERMIT_TYPES.CompliancePermit.map((field) => ({
        name: field.name,
        type: field.type,
      })),
    },
    {
      wallet: args.wallet,
      deprizeId: args.deprizeId,
      deadline: args.deadline,
    }
  )
  return signature as Hex
}

export function hashCompliancePermit(args: {
  wallet: Hex
  deprizeId: bigint
  deadline: bigint
  chainId: number
  mintAddress: Hex
}): Hex {
  return hashTypedData({
    domain: complianceDomain(args.chainId, args.mintAddress),
    types: COMPLIANCE_PERMIT_TYPES,
    primaryType: 'CompliancePermit',
    message: {
      wallet: args.wallet,
      deprizeId: args.deprizeId,
      deadline: args.deadline,
    },
  })
}

export function permitTtlSeconds(): number {
  const n = Number(process.env.DEPRIZE_PERMIT_TTL_SECONDS)
  if (!Number.isFinite(n) || n <= 0 || n > 3600) return DEFAULT_PERMIT_TTL_SECONDS
  return n
}
