import VotingEscrowABI from 'const/abis/VotingEscrow.json'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from 'const/config'
import { getContract, prepareContractCall, readContract, sendAndConfirmTransaction } from 'thirdweb'
import { Account } from 'thirdweb/wallets'
import { SECONDS_PER_YEAR } from '@/lib/subscription/citizenCheckout'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'

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

/** Approve MOONEY if needed, then add it to a live lock or open a one-year lock. */
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
