import {
  CITIZEN_ADDRESSES,
  CITIZEN_CHECKOUT_ADDRESSES,
  DEFAULT_CHAIN_V5,
  TEAM_ADDRESSES,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { getETHPrice } from '@/lib/etherscan'
import {
  FALLBACK_CITIZEN_YEAR_ETH,
  FALLBACK_CITIZEN_YEAR_USD,
  FALLBACK_TEAM_YEAR_ETH,
  FALLBACK_TEAM_YEAR_USD,
  publicYearWei,
  yearlyUsd,
} from '@/lib/subscription/publicYearPrice'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

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

const POOL_FEE_ABI = [
  {
    inputs: [],
    name: 'poolFee',
    outputs: [{ internalType: 'uint24', name: '', type: 'uint24' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const READ_TIMEOUT_MS = 8_000

export type PublicYearlyUsd = {
  citizenYearUsd: number
  teamYearUsd: number
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

async function checkoutIsLive(chain: typeof DEFAULT_CHAIN_V5, chainSlug: string): Promise<boolean> {
  const address = CITIZEN_CHECKOUT_ADDRESSES[chainSlug]
  if (!address) return false
  try {
    await readContract({
      contract: getContract({
        client: serverClient,
        address,
        chain,
        abi: POOL_FEE_ABI as any,
      }),
      method: 'poolFee' as string,
      params: [],
    })
    return true
  } catch {
    return false
  }
}

async function readYearEth(kind: 'citizen' | 'team'): Promise<number | null> {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const address = kind === 'citizen' ? CITIZEN_ADDRESSES[chainSlug] : TEAM_ADDRESSES[chainSlug]
  if (!address) return null

  const contract = getContract({
    client: serverClient,
    address,
    chain,
    abi: YEAR_PRICE_ABI as any,
  })
  const pricePerSecond = BigInt(
    (await readContract({
      contract,
      method: 'pricePerSecond' as string,
      params: [],
    })) as any
  )
  const teamDiscount =
    kind === 'team'
      ? BigInt(
          (await readContract({
            contract,
            method: 'discount' as string,
            params: [],
          })) as any
        )
      : BigInt(0)
  const citizenCheckoutLive = kind === 'citizen' ? await checkoutIsLive(chain, chainSlug) : false
  const wei = publicYearWei({
    kind,
    pricePerSecond,
    teamDiscount,
    citizenCheckoutLive,
  })
  const eth = Number(wei) / 1e18
  return Number.isFinite(eth) && eth > 0 ? eth : null
}

async function readEthUsd(): Promise<number | null> {
  try {
    const price = await getETHPrice()
    if (Number.isFinite(price) && price > 0) return price
  } catch (error) {
    console.error('ETH/USD quote failed for public yearly price', error)
  }
  return null
}

async function readPublicYearlyUsdInner(): Promise<PublicYearlyUsd> {
  const [ethUsd, citizenEth, teamEth] = await Promise.all([
    readEthUsd(),
    readYearEth('citizen').catch((error) => {
      console.error('Citizen year price unavailable', error)
      return null
    }),
    readYearEth('team').catch((error) => {
      console.error('Team year price unavailable', error)
      return null
    }),
  ])

  return {
    citizenYearUsd: yearlyUsd({
      yearEth: citizenEth,
      ethUsd,
      fallbackEth: FALLBACK_CITIZEN_YEAR_ETH,
      fallbackUsd: FALLBACK_CITIZEN_YEAR_USD,
    }),
    teamYearUsd: yearlyUsd({
      yearEth: teamEth,
      ethUsd,
      fallbackEth: FALLBACK_TEAM_YEAR_ETH,
      fallbackUsd: FALLBACK_TEAM_YEAR_USD,
    }),
  }
}

/** On-chain yearly dues in USD for the first HTML of /join. Always a positive number. */
export async function readPublicYearlyUsd(): Promise<PublicYearlyUsd> {
  try {
    return await withTimeout(readPublicYearlyUsdInner(), READ_TIMEOUT_MS)
  } catch (error) {
    console.error('Public yearly USD unavailable, using fallback', error)
    return {
      citizenYearUsd: FALLBACK_CITIZEN_YEAR_USD,
      teamYearUsd: FALLBACK_TEAM_YEAR_USD,
    }
  }
}
