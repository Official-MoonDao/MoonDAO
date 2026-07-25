import ProposalsABI from 'const/abis/Proposals.json'
import {
  PROPOSALS_ADDRESSES,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { isOperator } from 'middleware/isOperator'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  getContract,
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

// thirdweb's RPC layer occasionally returns `undefined` for a successful
// view call, which then crashes viem's decoder ("Cannot read properties of
// undefined (reading 'buffer')"). The `vote.ts` endpoint hits the same
// race and uses an identical retry helper — copied here so each closeSenate
// click stays self-contained instead of throwing on a flaky read.
async function readContractWithRetry<T>(
  contract: any,
  method: string,
  params: any[],
  maxRetries = 4,
  baseDelayMs = 400
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await readContract({ contract, method, params })
      return result as T
    } catch (error) {
      lastError = error
      const message =
        error instanceof Error ? error.message : String(error ?? '')
      const transient =
        (error instanceof TypeError && message.includes('buffer')) ||
        message.includes('Block not found') ||
        message.includes('block not found') ||
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('ECONNRESET')
      if (!transient || attempt === maxRetries - 1) throw error
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

// Close the Senate Vote on a non-project proposal by calling
// `Proposals.tallyVotes(mdp)` from the HSM wallet that owns the Proposals
// contract. Mirrors `nonProjectVote.ts` (which closes the Member Vote): the
// Executive Lead clicks the UI button, this endpoint actually signs the tx
// because `tallyVotes` is `onlyOwner` and the owner is the HSM/server wallet
// (`createHSMWallet()`) — Executive Lead EOAs cannot call it directly.
//
// `tallyVotes` is a no-op below quorum, so we pre-check on-chain and return
// 400 instead of burning gas on a tx that does nothing. We also reject if
// the senate vote has already been closed (either approved or failed), and
// surface the resulting flags so the UI can show "passed" / "failed".
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const mdp = parseInt(req.body?.mdp, 10)
  if (!Number.isInteger(mdp) || mdp <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid mdp: must be a positive integer.' })
  }

  const proposalContract = getContract({
    client: serverClient,
    address: PROPOSALS_ADDRESSES[chainSlug],
    abi: ProposalsABI.abi as any,
    chain: chain,
  })

  // The Proposals JSON ABI in the repo (newer, unreleased version) omits
  // `getQuorum()` — the live Arbitrum contract is the older Proposals.sol
  // which still exposes it. We pass fully-qualified signatures here so
  // thirdweb's readContract bypasses the JSON ABI lookup and just calls
  // the on-chain function directly.
  let tempCheckApproved: boolean
  let tempCheckFailed: boolean
  let voteCount: number
  let approvalCount: number
  let quorum: number
  try {
    const [approvedRaw, failedRaw, countRaw, approvalRaw, quorumRaw] =
      await Promise.all([
        readContractWithRetry<boolean>(
          proposalContract,
          'function tempCheckApproved(uint256) view returns (bool)',
          [mdp]
        ),
        readContractWithRetry<boolean>(
          proposalContract,
          'function tempCheckFailed(uint256) view returns (bool)',
          [mdp]
        ),
        readContractWithRetry<bigint>(
          proposalContract,
          'function tempCheckVoteCount(uint256) view returns (uint256)',
          [mdp]
        ),
        readContractWithRetry<bigint>(
          proposalContract,
          'function tempCheckApprovalCount(uint256) view returns (uint256)',
          [mdp]
        ),
        readContractWithRetry<bigint>(
          proposalContract,
          'function getQuorum() view returns (uint256)',
          []
        ),
      ])
    tempCheckApproved = Boolean(approvedRaw)
    tempCheckFailed = Boolean(failedRaw)
    voteCount = Number(countRaw)
    approvalCount = Number(approvalRaw)
    quorum = Number(quorumRaw)
  } catch (error) {
    console.error('[closeSenate] failed to read proposal state:', error)
    return res
      .status(500)
      .json({ error: 'Failed to read proposal state from chain.' })
  }

  if (tempCheckApproved) {
    return res.status(400).json({
      error: 'Senate vote already closed: proposal already passed temp check.',
    })
  }
  if (tempCheckFailed) {
    return res.status(400).json({
      error: 'Senate vote already closed: proposal already failed temp check.',
    })
  }
  if (voteCount < quorum) {
    return res.status(400).json({
      error: `Senate quorum not reached: ${voteCount}/${quorum} senators voted.`,
      voteCount,
      quorum,
    })
  }

  // Arbitrum blocks land every ~250ms and thirdweb's gas estimator
  // occasionally hits "Block not found" mid-call when the RPC node serves
  // a `latest` it can't immediately fetch. Retry a few times before giving
  // up — every other path that signs Proposals txs (e.g. nonProjectVote.ts)
  // hits the same race in practice.
  let txHash: string | undefined
  let lastError: unknown
  const account = await createHSMWallet()
  const transaction = prepareContractCall({
    contract: proposalContract,
    method: 'function tallyVotes(uint256)',
    params: [BigInt(mdp)],
  })
  const MAX_TX_ATTEMPTS = 4
  for (let attempt = 1; attempt <= MAX_TX_ATTEMPTS; attempt++) {
    try {
      const receipt = await sendAndConfirmTransaction({ transaction, account })
      txHash = receipt.transactionHash
      break
    } catch (error) {
      lastError = error
      const message =
        error instanceof Error ? error.message : String(error ?? '')
      const transient =
        message.includes('Block not found') ||
        message.includes('block not found') ||
        message.includes('rate limit') ||
        message.includes('timeout')
      console.error(
        `[closeSenate] tallyVotes tx attempt ${attempt}/${MAX_TX_ATTEMPTS} failed:`,
        error
      )
      if (!transient || attempt === MAX_TX_ATTEMPTS) break
      const delayMs = 750 * Math.pow(2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  if (!txHash) {
    return res.status(500).json({
      error: 'Failed to send tallyVotes transaction.',
      details:
        lastError instanceof Error ? lastError.message : String(lastError),
    })
  }

  // Re-read state so the UI can show the actual outcome rather than guess
  // from the pre-tally numbers (the tx already confirmed at this point).
  let passed = false
  try {
    const [approvedAfter, failedAfter] = await Promise.all([
      readContractWithRetry<boolean>(
        proposalContract,
        'function tempCheckApproved(uint256) view returns (bool)',
        [mdp]
      ),
      readContractWithRetry<boolean>(
        proposalContract,
        'function tempCheckFailed(uint256) view returns (bool)',
        [mdp]
      ),
    ])
    passed = Boolean(approvedAfter) && !Boolean(failedAfter)
  } catch (error) {
    console.warn(
      '[closeSenate] post-tx read failed; defaulting passed flag to vote ratio.',
      error
    )
    passed = approvalCount * 3 >= voteCount * 2
  }

  return res.status(200).json({
    mdp,
    passed,
    voteCount,
    approvalCount,
    quorum,
    txHash,
  })
}

export default withMiddleware(handler, rateLimit, isOperator)
