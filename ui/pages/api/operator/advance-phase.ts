import ProposalsABI from 'const/abis/Proposals.json'
import {
  DEFAULT_CHAIN_V5,
  PROJECT_CYCLE,
  PROJECT_TABLE_NAMES,
  PROPOSALS_ADDRESSES,
} from 'const/config'
import { BLOCKED_MDPS, BLOCKED_PROJECTS } from 'const/whitelist'
import { isOperator } from 'middleware/isOperator'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import {
  getContract,
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { createHSMWallet, isHSMAvailable } from '@/lib/google/hsm-signer'
import { PROJECT_PENDING } from '@/lib/nance/types'
import {
  getLivePhaseOverride,
  getNextPhase,
  resolveLivePhase,
  setLivePhaseOverride,
} from '@/lib/operator/cyclePhase'
import { getPrivyUserData } from '@/lib/privy'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { authOptions } from '../auth/[...nextauth]'

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)

// thirdweb's RPC layer occasionally returns `undefined` for a successful view
// call, which then crashes viem's decoder. Same retry helper used by
// closeSenate.ts / vote.ts so a flaky read doesn't abort the whole advance.
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
      return (await readContract({ contract, method, params })) as T
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error ?? '')
      const transient =
        (error instanceof TypeError && message.includes('buffer')) ||
        message.includes('Block not found') ||
        message.includes('block not found') ||
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('ECONNRESET')
      if (!transient || attempt === maxRetries - 1) throw error
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)))
    }
  }
  throw lastError
}

type SenateTallyResult = {
  mdp: number
  projectId: number | string
  name?: string
  status: 'passed' | 'failed' | 'already-closed' | 'below-quorum' | 'error'
  voteCount?: number
  approvalCount?: number
  quorum?: number
  txHash?: string
  error?: string
}

// Close the Senate Vote for every pending project proposal in the current
// cycle by calling `Proposals.tallyVotes(mdp)` from the HSM wallet that owns
// the Proposals contract. Mirrors closeSenate.ts (which does a single MDP),
// but batches the whole current-quarter cohort so the operator doesn't have
// to visit each proposal page. `tallyVotes` is a no-op below quorum, so we
// pre-check and skip those instead of burning gas.
async function tallySenateForCurrentCycle(
  dryRun: boolean
): Promise<{ results: SenateTallyResult[]; blockers: SenateTallyResult[] }> {
  const proposalContract = getContract({
    client: serverClient,
    address: PROPOSALS_ADDRESSES[chainSlug],
    abi: ProposalsABI.abi as any,
    chain,
  })

  const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE quarter = ${PROJECT_CYCLE.quarter} AND year = ${PROJECT_CYCLE.year}`
  const projects = (await queryTable(chain, projectStatement)) || []

  // Only pending proposals with an MDP can be in Senate Vote. Proposals that
  // are blocked from the /projects UI (withdrawn, resubmitted, or otherwise
  // removed via `BLOCKED_MDPS` / `BLOCKED_PROJECTS`) are excluded here too —
  // they were pulled from Senate voting, so senators never voted on them and
  // they'd otherwise show up as permanent below-quorum blockers. This mirrors
  // the `isCurrentPending` filter in `pages/projects/index.tsx`.
  const pendingCandidates = projects.filter(
    (p: any) =>
      Number(p.active) === PROJECT_PENDING &&
      p.MDP !== undefined &&
      p.MDP !== null &&
      !BLOCKED_PROJECTS.has(Number(p.id)) &&
      !BLOCKED_MDPS.has(Number(p.MDP)) &&
      !!p.proposalIPFS
  )

  // Mirror the IPFS filters in `pages/projects/index.tsx` / PR #1475: author
  // delete re-pins the proposal JSON with `deleted: true`, and non-project
  // proposals are governance-only. Both are hidden from the Senate Vote UI,
  // so they must not appear as below-quorum blockers here either. A failed
  // IPFS fetch must still include the proposal (same as /projects): senators
  // still see it as open, so it must be tallied / able to block advance.
  const pending: any[] = []
  await Promise.all(
    pendingCandidates.map(async (project: any) => {
      try {
        const res = await fetch(project.proposalIPFS)
        if (!res.ok) {
          console.warn(
            `[advance-phase] proposalIPFS HTTP ${res.status} for MDP-${project.MDP}; including for tally`
          )
          pending.push(project)
          return
        }
        const proposalJSON = await res.json()
        if (proposalJSON?.deleted) {
          console.log(
            `[advance-phase] skipping MDP-${project.MDP}: author-deleted (IPFS deleted:true)`
          )
          return
        }
        if (proposalJSON?.nonProjectProposal) {
          console.log(
            `[advance-phase] skipping MDP-${project.MDP}: non-project proposal`
          )
          return
        }
        pending.push(project)
      } catch (error) {
        console.warn(
          `[advance-phase] failed to read proposalIPFS for MDP-${project.MDP}; including for tally`,
          error
        )
        pending.push(project)
      }
    })
  )

  const results: SenateTallyResult[] = []
  const account = dryRun ? null : await createHSMWallet()

  // Read quorum once (same value for every proposal). Fully-qualified
  // signature so thirdweb bypasses the JSON ABI (which omits getQuorum on the
  // live contract) — same trick closeSenate.ts uses. Abort if we can't read
  // it: falling back to 0 would let every pending MDP pass the pre-check.
  let quorum: number
  try {
    quorum = Number(
      await readContractWithRetry<bigint>(
        proposalContract,
        'function getQuorum() view returns (uint256)',
        []
      )
    )
  } catch (error) {
    console.error('[advance-phase] getQuorum failed:', error)
    throw new Error('Failed to read Senate quorum from chain.')
  }

  for (const project of pending) {
    const mdp = Number(project.MDP)
    const base: Omit<SenateTallyResult, 'status'> = {
      mdp,
      projectId: project.id,
      name: project.name,
      quorum,
    }
    try {
      const [approved, failed, voteCount, approvalCount] = await Promise.all([
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
      ])
      base.voteCount = Number(voteCount)
      base.approvalCount = Number(approvalCount)

      if (approved) {
        results.push({ ...base, status: 'passed' })
        continue
      }
      if (failed) {
        results.push({ ...base, status: 'failed' })
        continue
      }
      if (Number(voteCount) < quorum) {
        results.push({ ...base, status: 'below-quorum' })
        continue
      }

      if (dryRun) {
        // Would tally, but don't send. Report the expected outcome from the
        // on-chain 2/3 supermajority rule so the operator can preview.
        const wouldPass = Number(approvalCount) * 3 >= Number(voteCount) * 2
        results.push({ ...base, status: wouldPass ? 'passed' : 'failed' })
        continue
      }

      const transaction = prepareContractCall({
        contract: proposalContract,
        method: 'function tallyVotes(uint256)',
        params: [BigInt(mdp)],
      })
      let txHash: string | undefined
      let lastError: unknown
      const MAX_TX_ATTEMPTS = 4
      for (let attempt = 1; attempt <= MAX_TX_ATTEMPTS; attempt++) {
        try {
          const receipt = await sendAndConfirmTransaction({
            transaction,
            account: account as any,
          })
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
          if (!transient || attempt === MAX_TX_ATTEMPTS) break
          await new Promise((r) => setTimeout(r, 750 * Math.pow(2, attempt - 1)))
        }
      }
      if (!txHash) {
        results.push({
          ...base,
          status: 'error',
          error:
            lastError instanceof Error ? lastError.message : String(lastError),
        })
        continue
      }

      // Re-read to report the real outcome rather than guessing.
      let passed = Number(approvalCount) * 3 >= Number(voteCount) * 2
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
      } catch {
        /* fall back to the pre-tx ratio computed above */
      }
      results.push({ ...base, status: passed ? 'passed' : 'failed', txHash })
    } catch (error) {
      results.push({
        ...base,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Blockers = anything that leaves the Senate Vote unfinished: proposals that
  // still haven't reached quorum, or that errored during tally.
  const blockers = results.filter(
    (r) => r.status === 'below-quorum' || r.status === 'error'
  )
  return { results, blockers }
}

/**
 * One-click phase advance for the project cycle.
 *
 * Body: { dryRun?: boolean, force?: boolean }
 *
 * - Senate → Member: closes the Senate Vote on-chain (tallyVotes per pending
 *   MDP), then flips the live phase to 'member' (opens Member Vote + Retro).
 *   Refuses (409) if any proposal is still below quorum or errored, unless
 *   `force: true`. `dryRun: true` previews the tally plan without sending txs
 *   or flipping the phase.
 * - Member → idle: flips the live phase to 'idle' (wraps up the cycle UI).
 *   The Member Vote on-chain tally (which moves funds / flips winners to
 *   active) is intentionally kept behind its own dedicated action
 *   (`POST /api/proposals/vote`, surfaced in the operator panel) with its
 *   voting-window + snapshot safeguards, so this route does NOT run it.
 *
 * Advancing from 'idle' into the next cycle's Senate Vote is not a runtime
 * flip — it requires editing PROJECT_CYCLE (new quarter/budget/retro), a
 * reviewed config change.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const dryRun = req.body?.dryRun === true
  const force = req.body?.force === true

  const override = await getLivePhaseOverride()
  const currentPhase = resolveLivePhase(override)
  const nextPhase = getNextPhase(currentPhase)

  if (!nextPhase) {
    return res.status(400).json({
      error:
        'Cycle is idle — nothing to advance to. Start the next cycle by editing PROJECT_CYCLE in const/config.ts (new quarter, budget, retro pool) and deploying.',
      currentPhase,
    })
  }

  // Resolve who is advancing the phase for the audit note (best-effort).
  let setBy: string | undefined
  try {
    const session = await getServerSession(req, res, authOptions)
    if (session?.accessToken) {
      const privyUserData = await getPrivyUserData(session.accessToken)
      setBy = privyUserData?.walletAddresses?.[0]
    }
  } catch (err) {
    console.warn('[advance-phase] could not derive setBy address:', err)
  }

  // Senate → Member requires the on-chain Senate tally.
  if (currentPhase === 'senate' && nextPhase === 'member') {
    if (!dryRun && !isHSMAvailable()) {
      return res.status(500).json({
        error:
          'HSM signer not available. Set GCP_SIGNER_SERVICE_ACCOUNT and GCP_PROJECT_ID.',
      })
    }

    let tally: Awaited<ReturnType<typeof tallySenateForCurrentCycle>>
    try {
      tally = await tallySenateForCurrentCycle(dryRun)
    } catch (error) {
      console.error('[advance-phase] senate tally failed:', error)
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to tally Senate votes.',
      })
    }

    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        currentPhase,
        nextPhase,
        senateTally: tally.results,
        blockers: tally.blockers,
        wouldAdvance: tally.blockers.length === 0 || force,
      })
    }

    if (tally.blockers.length > 0 && !force) {
      return res.status(409).json({
        error:
          'Senate Vote not fully closed: some proposals are below quorum or errored. Resolve them, or retry with force to advance anyway.',
        currentPhase,
        nextPhase,
        senateTally: tally.results,
        blockers: tally.blockers,
      })
    }

    // Tallies may already be on-chain at this point. Catch KV failures so the
    // client learns tallies succeeded and can retry only the phase flip.
    let saved: Awaited<ReturnType<typeof setLivePhaseOverride>>
    try {
      saved = await setLivePhaseOverride({
        phase: 'member',
        // Open distribute/submit UI with the phase flip — config defaults
        // memberVoteSubmissionsOpen to false until a redeploy, which would
        // leave Member Vote "open" but submissions permanently gated.
        memberVoteSubmissionsOpen: true,
        setBy,
        note: `Advanced Senate → Member${force ? ' (forced)' : ''} from operator panel`,
      })
    } catch (err) {
      console.error(
        '[advance-phase] phase override failed after senate tally:',
        err
      )
      return res.status(500).json({
        error:
          'Senate tallies succeeded on-chain, but failed to set live phase to member. Retry Advance Phase (or fix Upstash) — already-tallied proposals are skipped.',
        currentPhase,
        nextPhase,
        senateTally: tally.results,
        blockers: tally.blockers,
        tallySucceeded: true,
        phaseOverrideFailed: true,
      })
    }

    // Bust the ISR cache so visitors who reload (or whose phase poll triggers
    // a reload) pick up fresh Senate flags + retro distributions for the new
    // phase instead of the prior-cycle getStaticProps snapshot.
    try {
      await res.revalidate('/projects')
    } catch (err) {
      console.warn('[advance-phase] failed to revalidate /projects:', err)
    }

    return res.status(200).json({
      success: true,
      currentPhase,
      newPhase: saved.phase,
      senateTally: tally.results,
      blockers: tally.blockers,
      override: saved,
    })
  }

  // Member → idle: UI wrap-up only. The member-vote on-chain tally is a
  // separate, safeguarded action.
  if (currentPhase === 'member' && nextPhase === 'idle') {
    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        currentPhase,
        nextPhase,
        note: 'Would wrap up the cycle (set live phase to idle). Run the Member Vote tally (POST /api/proposals/vote) first if it has not been run.',
        wouldAdvance: true,
      })
    }
    let saved: Awaited<ReturnType<typeof setLivePhaseOverride>>
    try {
      saved = await setLivePhaseOverride({
        phase: 'idle',
        setBy,
        note: 'Wrapped up cycle (Member → idle) from operator panel',
      })
    } catch (err) {
      console.error('[advance-phase] phase override failed (member → idle):', err)
      return res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to set live phase to idle.',
        currentPhase,
        nextPhase,
        phaseOverrideFailed: true,
      })
    }

    try {
      await res.revalidate('/projects')
    } catch (err) {
      console.warn('[advance-phase] failed to revalidate /projects:', err)
    }

    return res.status(200).json({
      success: true,
      currentPhase,
      newPhase: saved.phase,
      reminder:
        'Cycle UI wrapped up. Ensure the Member Vote on-chain tally has been run (operator panel → "Run Member Vote Tally").',
      override: saved,
    })
  }

  return res.status(400).json({
    error: `Unsupported transition ${currentPhase} → ${nextPhase}.`,
    currentPhase,
    nextPhase,
  })
}

export default withMiddleware(handler, rateLimit, isOperator)
