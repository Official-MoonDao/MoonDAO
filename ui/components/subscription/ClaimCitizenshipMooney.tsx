import { DEFAULT_CHAIN_V5, MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, readContract } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { useActiveAccount } from 'thirdweb/react'
import { citizenCheckoutAddress, citizenCheckoutIsLive } from '@/lib/subscription/citizenCheckout'
import {
  claimableCitizenshipMooney,
  clearClaimCeiling,
  clearUnlockedCitizenshipMooney,
  decodeDepositLog,
  decodeStakeLog,
  formatMooneyAmount,
  mergeCitizenshipMooneyClaim,
  noteCitizenshipMooneyLocked,
  readClaimCeiling,
  readUnlockedCitizenshipMooney,
  type CitizenshipMooneyLog,
} from '@/lib/subscription/citizenshipMooneyClaim'
import { lockCitizenshipMooney } from '@/lib/subscription/lockCitizenshipMooney'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

const BALANCE_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

type ClaimView =
  | { kind: 'hidden' }
  | { kind: 'claim'; amount: bigint; pending: bigint; shortfall: boolean }
  | { kind: 'missing' }

async function logsFor(address: string, topic: string, wallet: string): Promise<any[]> {
  const provider = ethers5Adapter.provider.toEthers({
    client,
    chain: DEFAULT_CHAIN_V5,
  })
  return provider.getLogs({
    address,
    fromBlock: 0,
    toBlock: 'latest',
    topics: [topic, ethers.utils.hexZeroPad(wallet, 32)],
  })
}

/**
 * Pending citizenship MOONEY. A failed log read keeps the amount saved at mint
 * time when the wallet still holds it. A successful read that shows the stake
 * was locked clears that saved amount.
 */
export async function resolveCitizenshipMooneyClaim(wallet: string): Promise<ClaimView> {
  const saved = readUnlockedCitizenshipMooney(wallet)
  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const mooneyAddress = MOONEY_ADDRESSES[chainSlug]
  let balance = BigInt(0)
  if (mooneyAddress) {
    try {
      const raw = await readContract({
        contract: getContract({
          client,
          address: mooneyAddress,
          chain: DEFAULT_CHAIN_V5,
          abi: BALANCE_ABI as any,
        }),
        method: 'balanceOf' as string,
        params: [wallet],
      })
      balance = BigInt(raw as any)
    } catch (err) {
      console.error('Failed to read MOONEY balance', err)
    }
  }

  let chainAmount = BigInt(0)
  let chainOk = false
  let sawStake = false
  const checkout = citizenCheckoutAddress(chainSlug)
  const ve = VMOONEY_ADDRESSES[chainSlug]
  if (checkout && ve && (await citizenCheckoutIsLive(DEFAULT_CHAIN_V5))) {
    try {
      const [stakeLogs, depositLogs] = await Promise.all([
        logsFor(checkout, ethers.utils.id('Stake(address,uint256,bool)'), wallet),
        logsFor(ve, ethers.utils.id('Deposit(address,uint256,uint256,int128,uint256)'), wallet),
      ])
      const stakes = stakeLogs
        .map((log) => decodeStakeLog(log))
        .filter((log): log is CitizenshipMooneyLog => log != null)
      const deposits = depositLogs
        .map((log) => decodeDepositLog(log))
        .filter((log): log is CitizenshipMooneyLog => log != null)
      sawStake = stakes.some((stake) => !stake.locked)
      chainAmount = claimableCitizenshipMooney(stakes, deposits)
      chainOk = true
    } catch (err) {
      console.error('Failed to read citizenship MOONEY stakes', err)
    }
  }

  const merged = mergeCitizenshipMooneyClaim({
    saved,
    chainAmount,
    chainOk,
    sawStake,
    balance,
    ceiling: readClaimCeiling(wallet),
  })
  if (merged.clearSaved) clearUnlockedCitizenshipMooney(wallet)
  if (merged.clearCeiling) clearClaimCeiling(wallet)

  if (merged.pending <= BigInt(0)) return { kind: 'hidden' }
  if (balance <= BigInt(0)) return { kind: 'missing' }
  return {
    kind: 'claim',
    pending: merged.pending,
    amount: balance < merged.pending ? balance : merged.pending,
    shortfall: balance < merged.pending,
  }
}

export default function ClaimCitizenshipMooney({ address }: { address?: string }) {
  const account = useActiveAccount()
  const [view, setView] = useState<ClaimView>({ kind: 'hidden' })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!address) {
      setView({ kind: 'hidden' })
      return
    }
    let cancelled = false
    resolveCitizenshipMooneyClaim(address).then((next) => {
      if (!cancelled) setView(next)
    })
    return () => {
      cancelled = true
    }
  }, [address, refreshKey])

  if (!address || view.kind === 'hidden') return null

  return (
    <div
      id="claim-citizenship-mooney"
      className="mb-6 rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-900/50 via-blue-900/30 to-purple-900/40 p-5"
    >
      <h3 className="font-heading font-semibold text-white text-lg mb-2">
        Claim your voting power
      </h3>
      {view.kind === 'missing' ? (
        <p className="text-slate-300 text-sm leading-relaxed">
          The MOONEY from your citizenship is no longer in this wallet, so it can&apos;t be locked
          for voting power.
        </p>
      ) : (
        <>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Your citizenship bought {formatMooneyAmount(view.pending)} MOONEY. Lock it for one year
            to get vMOONEY voting power.
            {view.shortfall
              ? ` Some of it has left this wallet. This locks the ${formatMooneyAmount(
                  view.amount
                )} still here.`
              : ''}
          </p>
          <PrivyWeb3Button
            id="claim-citizenship-mooney-button"
            label="Lock MOONEY"
            loadingLabel="Locking..."
            requiredChain={DEFAULT_CHAIN_V5}
            className="rounded-xl text-sm"
            action={async () => {
              if (!account || view.kind !== 'claim')
                throw new Error('Connect a wallet to lock MOONEY')
              try {
                await lockCitizenshipMooney({
                  account,
                  chain: DEFAULT_CHAIN_V5,
                  amount: view.amount,
                })
                noteCitizenshipMooneyLocked(address, view.amount, view.pending)
                toast.success('Locked. You have vMOONEY voting power.')
                setRefreshKey((key) => key + 1)
              } catch (err: any) {
                const detail = `${err?.reason || ''} ${err?.message || ''}`
                toast.error(
                  /reject|denied|cancel/i.test(detail)
                    ? 'Lock cancelled. The MOONEY is still in your wallet.'
                    : 'Could not lock that MOONEY. It is still in your wallet.'
                )
                throw err
              }
            }}
          />
        </>
      )}
    </div>
  )
}
