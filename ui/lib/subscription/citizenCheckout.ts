import CitizenCheckoutABI from 'const/abis/CitizenCheckout.json'
import VotingEscrowABI from 'const/abis/VotingEscrow.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_CHECKOUT_ADDRESSES,
  DEFAULT_CHAIN_V5,
  MOONEY_ADDRESSES,
  MOONEY_WETH_POOL_FEE,
  TEAM_ADDRESSES,
  UNISWAP_V3_QUOTER_V2_ADDRESSES,
  VMOONEY_ADDRESSES,
  WETH_ADDRESSES,
} from 'const/config'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { getContract, prepareContractCall, readContract, sendAndConfirmTransaction } from 'thirdweb'
import { Account } from 'thirdweb/wallets'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'

export const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

const ERC20_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        internalType: 'struct IQuoterV2.QuoteExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
      { internalType: 'uint32', name: 'initializedTicksCrossed', type: 'uint32' },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const liveCache = new Map<string, Promise<boolean>>()

export function citizenCheckoutAddress(chainSlug: string): string | undefined {
  return CITIZEN_CHECKOUT_ADDRESSES[chainSlug]
}

/** Wallet total is 4/3 of the treasury share, so one quarter of the payment buys MOONEY. */
export function citizenCheckoutTotalWei(treasuryWei: bigint): bigint {
  if (treasuryWei <= BigInt(0)) return BigInt(0)
  return (treasuryWei * BigInt(4)) / BigInt(3)
}

export async function walletPaymentForTreasury(
  chain: { id: number },
  treasuryWei: bigint
): Promise<bigint> {
  if (!(await citizenCheckoutIsLive(chain))) return treasuryWei
  return citizenCheckoutTotalWei(treasuryWei)
}

const YEAR_PRICE_ABI = [
  {
    inputs: [],
    name: 'pricePerSecond',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'discount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

/** Public yearly price in ETH. Teams include the on-chain discount. Citizens include the MOONEY quarter once checkout is deployed. */
export function usePublicYearEth(kind: 'citizen' | 'team'): number | null {
  const [eth, setEth] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const address = kind === 'citizen' ? CITIZEN_ADDRESSES[chainSlug] : TEAM_ADDRESSES[chainSlug]
    const contract = getContract({
      client,
      address,
      chain,
      abi: YEAR_PRICE_ABI as any,
    })
    readContract({ contract, method: 'pricePerSecond' as string, params: [] })
      .then(async (pps) => {
        let year = BigInt(pps as any) * BigInt(SECONDS_PER_YEAR)
        if (kind === 'team') {
          const discount = BigInt(
            (await readContract({ contract, method: 'discount' as string, params: [] })) as any
          )
          year = (year * (BigInt(1000) - discount)) / BigInt(1000)
        } else if (await citizenCheckoutIsLive(chain)) {
          year = citizenCheckoutTotalWei(year)
        }
        if (!cancelled) setEth(Number(year) / 1e18)
      })
      .catch((err) => {
        console.error('Failed to read subscription price', err)
      })
    return () => {
      cancelled = true
    }
  }, [kind])
  return eth
}

export function formatEthAmount(wei: bigint): string {
  const eth = Number(wei) / 1e18
  if (!Number.isFinite(eth)) return '0'
  return eth.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

export function citizenCheckoutContract(chain: { id: number }) {
  const chainSlug = getChainSlug(chain as any)
  const address = citizenCheckoutAddress(chainSlug)
  if (!address) return null
  return getContract({
    client,
    address,
    chain: chain as any,
    abi: CitizenCheckoutABI as any,
  })
}

export function citizenCheckoutIsLive(chain: { id: number }): Promise<boolean> {
  const chainSlug = getChainSlug(chain as any)
  const address = citizenCheckoutAddress(chainSlug)
  if (!address) return Promise.resolve(false)
  const cached = liveCache.get(chainSlug)
  if (cached) return cached
  const pending = readContract({
    contract: getContract({
      client,
      address,
      chain: chain as any,
      abi: CitizenCheckoutABI as any,
    }),
    method: 'poolFee' as string,
    params: [],
  })
    .then(() => true)
    .catch(() => false)
  liveCache.set(chainSlug, pending)
  return pending
}

export async function quoteMinMooneyOut(chain: { id: number }, stakeWei: bigint): Promise<bigint> {
  if (stakeWei <= BigInt(0)) return BigInt(0)
  const chainSlug = getChainSlug(chain as any)
  const quoter = getContract({
    client,
    address: UNISWAP_V3_QUOTER_V2_ADDRESSES[chainSlug],
    chain: chain as any,
    abi: QUOTER_ABI as any,
  })
  const quoted: any = await readContract({
    contract: quoter,
    method: 'quoteExactInputSingle' as string,
    params: [
      {
        tokenIn: WETH_ADDRESSES[chainSlug],
        tokenOut: MOONEY_ADDRESSES[chainSlug],
        amountIn: stakeWei,
        fee: MOONEY_WETH_POOL_FEE,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  })
  const amountOut = BigInt(quoted[0] ?? quoted.amountOut ?? quoted)
  if (amountOut <= BigInt(0)) {
    throw new Error('MOONEY quote failed. Try again in a moment.')
  }
  return (amountOut * BigInt(95)) / BigInt(100)
}

export type CitizenCheckoutProfile = {
  to: string
  name: string
  bio: string
  image: string
  location: string
  discord: string
  twitter: string
  website: string
  viewData: string
  formId: string
}

export function checkoutProfileTuple(profile: CitizenCheckoutProfile) {
  return [
    profile.to,
    profile.name,
    profile.bio,
    profile.image,
    profile.location,
    profile.discord,
    profile.twitter,
    profile.website,
    profile.viewData,
    profile.formId,
  ]
}

const STAKE_TOPIC = ethers.utils.id('Stake(address,uint256,bool)')

/** MOONEY amount from a checkout receipt that still needs a wallet lock. */
export function unlockedStakeFromReceipt(
  receipt: { logs?: any[] } | null | undefined
): bigint | null {
  for (const log of receipt?.logs ?? []) {
    const topic = log?.topics?.[0]
    if (typeof topic !== 'string' || topic.toLowerCase() !== STAKE_TOPIC.toLowerCase()) continue
    const decoded = ethers.utils.defaultAbiCoder.decode(['uint256', 'bool'], log.data)
    if (!decoded[1]) return BigInt(decoded[0].toString())
  }
  return null
}

export async function lockCitizenshipMooney({
  account,
  chain,
  amount,
}: {
  account: Account
  chain: { id: number }
  amount: bigint
}) {
  const chainSlug = getChainSlug(chain as any)
  const mooney = getContract({
    client,
    address: MOONEY_ADDRESSES[chainSlug],
    chain: chain as any,
    abi: ERC20_ABI as any,
  })
  const ve = getContract({
    client,
    address: VMOONEY_ADDRESSES[chainSlug],
    chain: chain as any,
    abi: VotingEscrowABI as any,
  })
  const owner = account.address
  const [allowance, locked] = await Promise.all([
    readContract({
      contract: mooney,
      method: 'allowance' as string,
      params: [owner, VMOONEY_ADDRESSES[chainSlug]],
    }),
    readContract({
      contract: ve,
      method: 'locked' as string,
      params: [owner],
    }),
  ])
  if (BigInt(allowance as any) < amount) {
    await sendAndConfirmTransaction({
      account,
      transaction: prepareContractCall({
        contract: mooney,
        method: 'approve' as string,
        params: [VMOONEY_ADDRESSES[chainSlug], amount],
      }),
    })
  }
  const lockedAmount = BigInt((locked as any)[0] ?? (locked as any).amount ?? 0)
  const lockedEnd = BigInt((locked as any)[1] ?? (locked as any).end ?? 0)
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (lockedAmount > BigInt(0) && lockedEnd > now) {
    await sendAndConfirmTransaction({
      account,
      transaction: prepareContractCall({
        contract: ve,
        method: 'increase_amount' as string,
        params: [amount],
      }),
    })
    return
  }
  const unlock = now + BigInt(SECONDS_PER_YEAR)
  await sendAndConfirmTransaction({
    account,
    transaction: prepareContractCall({
      contract: ve,
      method: 'create_lock' as string,
      params: [amount, unlock],
    }),
  })
}
