import ConditionalTokensABI from 'const/abis/ConditionalTokens.json'
import DePrizeRegistryABI from 'const/abis/DePrizeRegistry.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import {
  CONDITIONAL_TOKEN_ADDRESSES,
  DEPRIZE_QUESTION_ID,
  DEPRIZE_REGISTRY_ADDRESSES,
  ORACLE_ADDRESS,
  OPERATOR_ADDRESS,
} from 'const/config'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, prepareContractCall, type Chain } from 'thirdweb'
import { DePrizeState, MarketStage, UNIT } from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import { rpcRead } from '@/lib/deprize/read'
import { sendDePrizeTx } from '@/lib/deprize/tx'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import StandardButton from '@/components/layout/StandardButton'

type DePrizeAdminPanelProps = {
  deprizeId: number
  chain: Chain
  account: any
  state: DePrizeState
  teamIds: bigint[]
  cancellationPending: boolean
  marketAddress: string | undefined
  numOutcomes: number
  stage: number | undefined
  resolved: boolean
  marketFeesWei: bigint | undefined
  onDone: () => void
}

export default function DePrizeAdminPanel({
  deprizeId,
  chain,
  account,
  state,
  teamIds,
  cancellationPending,
  marketAddress,
  numOutcomes,
  stage,
  resolved,
  marketFeesWei,
  onDone,
}: DePrizeAdminPanelProps) {
  const userAddress = account?.address
  const chainSlug = getChainSlug(chain)
  const registryAddress = DEPRIZE_REGISTRY_ADDRESSES[chainSlug] ?? ''
  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[chainSlug] ?? ''

  const [busy, setBusy] = useState(false)
  const [isRegistryOwner, setIsRegistryOwner] = useState(false)
  const [winnerTeamId, setWinnerTeamId] = useState<string>('')
  const [providerAddress, setProviderAddress] = useState('')
  const [questionId, setQuestionId] = useState(DEPRIZE_QUESTION_ID)

  const isOracle =
    !!userAddress && userAddress.toLowerCase() === ORACLE_ADDRESS.toLowerCase()
  const isOperator =
    !!userAddress && userAddress.toLowerCase() === OPERATOR_ADDRESS.toLowerCase()

  const registry = useMemo(
    () =>
      registryAddress
        ? getContract({ client, chain, address: registryAddress, abi: DePrizeRegistryABI as any })
        : undefined,
    [chain, registryAddress]
  )
  const lmsr = useMemo(
    () =>
      marketAddress
        ? getContract({ client, chain, address: marketAddress, abi: LMSRWithTWAP.abi as any })
        : undefined,
    [chain, marketAddress]
  )
  const ctf = useMemo(
    () =>
      ctfAddress
        ? getContract({ client, chain, address: ctfAddress, abi: ConditionalTokensABI as any })
        : undefined,
    [chain, ctfAddress]
  )

  useEffect(() => {
    if (!registry || !userAddress) {
      setIsRegistryOwner(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const owner = await rpcRead<string>({
          contract: registry,
          method: 'owner' as string,
          params: [],
        })
        if (!cancelled)
          setIsRegistryOwner(owner.toLowerCase() === userAddress.toLowerCase())
      } catch {
        if (!cancelled) setIsRegistryOwner(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [registry, userAddress])

  const canSeeMarket = isOracle || isOperator
  if (!userAddress || (!isRegistryOwner && !canSeeMarket)) return null

  // Generic write helper with a toast lifecycle.
  const run = async (
    contract: any,
    method: string,
    params: any[],
    doneMsg: string
  ) => {
    if (!account || !contract) return
    setBusy(true)
    try {
      await sendDePrizeTx(account, prepareContractCall({ contract, method: method as string, params }))
      toast.success(doneMsg, { style: toastStyle })
      onDone()
    } catch (err: any) {
      console.error(`[deprize-admin] ${method} failed`, err)
      toast.error(err?.shortMessage || err?.message || `${method} failed.`, {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  const S = DePrizeState

  // Oracle resolution with the same pre-flight as DePrizeResolve.s.sol.
  const resolve = async (payouts: bigint[], label: string) => {
    if (!account || !ctf || !lmsr) return
    setBusy(true)
    try {
      const computed = await rpcRead<string>({
        contract: ctf,
        method: 'getConditionId' as string,
        params: [account.address, questionId, BigInt(numOutcomes)],
      })
      const marketConditionId = await rpcRead<string>({
        contract: lmsr,
        method: 'conditionIds' as string,
        params: [0n],
      })
      if (computed.toLowerCase() !== marketConditionId.toLowerCase()) {
        throw new Error(
          `Pre-flight: conditionId mismatch — keccak(yourAddress, questionId, ${numOutcomes}) != the market's condition. Check the question id and that you are the oracle.`
        )
      }
      const freshDen = await rpcRead<bigint>({
        contract: ctf,
        method: 'payoutDenominator' as string,
        params: [computed],
      })
      if (freshDen && freshDen > 0n) {
        throw new Error('Pre-flight: already resolved (payout vector is write-once).')
      }
      const freshStage = Number(
        await rpcRead<bigint | number>({
          contract: lmsr,
          method: 'stage' as string,
          params: [],
        })
      )
      if (freshStage !== MarketStage.Paused && freshStage !== MarketStage.Closed) {
        throw new Error(
          'Pre-flight: pause or close the market first — resolving a live market gives away free trades against the known outcome.'
        )
      }
      await sendDePrizeTx(
        account,
        prepareContractCall({
          contract: ctf,
          method: 'reportPayouts' as string,
          params: [questionId, payouts],
        })
      )
      toast.success(`Resolved: ${label}.`, { style: toastStyle })
      onDone()
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Resolve failed.', {
        style: toastStyle,
        duration: 10000,
      })
    } finally {
      setBusy(false)
    }
  }

  const resolveWinner = (winningIndex: number) =>
    resolve(
      Array.from({ length: numOutcomes }, (_, i) => (i === winningIndex ? 1n : 0n)),
      `outcome #${winningIndex + 1} wins`
    )
  const resolveNoWinner = () =>
    resolve(
      Array.from({ length: numOutcomes }, () => 1n),
      `no winner — every position refunds 1/${numOutcomes}`
    )

  const isClosed = stage === MarketStage.Closed

  return (
    <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 flex flex-col gap-5">
      <p className="text-yellow-300 text-xs font-medium">
        Admin actions
        {isRegistryOwner ? ' · registry owner' : ''}
        {isOracle ? ' · oracle' : ''}
        {isOperator ? ' · market owner' : ''}
      </p>

      {/* Registry lifecycle (registry owner) */}
      {isRegistryOwner && registry && (
        <div>
          <p className="text-gray-400 text-[11px] mb-2">DePrize lifecycle</p>
          <div className="flex items-center gap-2 flex-wrap">
            {state === S.DRAFT && (
              <StandardButton
                onClick={() => run(registry, 'open', [BigInt(deprizeId)], 'DePrize opened.')}
                disabled={busy}
                className="rounded-full"
                backgroundColor="bg-white/10"
              >
                Open betting
              </StandardButton>
            )}
            {state === S.OPEN && (
              <StandardButton
                onClick={() => run(registry, 'lock', [BigInt(deprizeId)], 'DePrize locked.')}
                disabled={busy}
                className="rounded-full"
                backgroundColor="bg-white/10"
              >
                Lock betting
              </StandardButton>
            )}
            {state === S.LOCKED && (
              <StandardButton
                onClick={() => run(registry, 'startVote', [BigInt(deprizeId)], 'Winner vote started.')}
                disabled={busy}
                className="rounded-full"
                backgroundColor="bg-white/10"
              >
                Start winner vote
              </StandardButton>
            )}
            {(state === S.LOCKED || state === S.VOTING) && (
              <StandardButton
                onClick={() => run(registry, 'settleNoWinner', [BigInt(deprizeId)], 'Settled: no winner.')}
                disabled={busy}
                className="rounded-full"
                backgroundColor="bg-moon-orange"
              >
                Settle: no winner
              </StandardButton>
            )}
            {state === S.SETTLED && (
              <StandardButton
                onClick={() => run(registry, 'releaseM1', [BigInt(deprizeId)], 'M1 released.')}
                disabled={busy}
                className="rounded-full"
                backgroundColor="bg-white/10"
              >
                Release M1 (30%)
              </StandardButton>
            )}
            {state === S.M1_RELEASED && (
              <>
                <StandardButton
                  onClick={() => run(registry, 'completeM2', [BigInt(deprizeId)], 'M2 complete.')}
                  disabled={busy}
                  className="rounded-full"
                  backgroundColor="bg-moon-green"
                >
                  Complete M2 (70%)
                </StandardButton>
                <StandardButton
                  onClick={() => run(registry, 'failM2', [BigInt(deprizeId)], 'M2 failed — refunds enabled.')}
                  disabled={busy}
                  className="rounded-full"
                  backgroundColor="bg-moon-orange"
                >
                  Fail M2 (refund)
                </StandardButton>
              </>
            )}
            {!cancellationPending && state !== S.NONE && (
              <StandardButton
                onClick={() =>
                  run(registry, 'announceCancellation', [BigInt(deprizeId)], 'Cancellation announced (7-day notice).')
                }
                disabled={busy}
                className="rounded-full"
                backgroundColor="bg-white/10"
              >
                Announce cancellation
              </StandardButton>
            )}
            {cancellationPending && (
              <>
                <StandardButton
                  onClick={() =>
                    run(registry, 'abortCancellation', [BigInt(deprizeId)], 'Cancellation aborted.')
                  }
                  disabled={busy}
                  className="rounded-full"
                  backgroundColor="bg-white/10"
                >
                  Abort cancellation
                </StandardButton>
                <StandardButton
                  onClick={() => run(registry, 'cancel', [BigInt(deprizeId)], 'DePrize cancelled.')}
                  disabled={busy}
                  className="rounded-full"
                  backgroundColor="bg-red-500/40"
                >
                  Execute cancel
                </StandardButton>
              </>
            )}
          </div>

          {/* Settle winner (needs a team selection) */}
          {(state === S.LOCKED || state === S.VOTING) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <select
                value={winnerTeamId}
                onChange={(e) => setWinnerTeamId(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-sm"
              >
                <option value="">Select winning team…</option>
                {teamIds.map((t, i) => (
                  <option key={t.toString()} value={t.toString()}>
                    #{i + 1} — team {t.toString()}
                  </option>
                ))}
              </select>
              <StandardButton
                onClick={() =>
                  run(
                    registry,
                    'settleWinner',
                    [BigInt(deprizeId), BigInt(winnerTeamId)],
                    'Winner declared.'
                  )
                }
                disabled={busy || !/^\d+$/.test(winnerTeamId)}
                className="rounded-full"
                backgroundColor="bg-moon-green"
              >
                Settle winner
              </StandardButton>
            </div>
          )}

          {/* Provider payout address (M5) */}
          {(state === S.SETTLED || state === S.M1_RELEASED) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={providerAddress}
                onChange={(e) => setProviderAddress(e.target.value.trim())}
                placeholder="Provider payout address (0x…)"
                className="flex-1 min-w-[240px] px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs font-mono placeholder-gray-500"
              />
              <StandardButton
                onClick={() =>
                  run(
                    registry,
                    'setProviderPayoutAddress',
                    [BigInt(deprizeId), providerAddress],
                    'Provider payout address set.'
                  )
                }
                disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(providerAddress)}
                className="rounded-full"
                backgroundColor="bg-white/10"
              >
                Set provider
              </StandardButton>
            </div>
          )}
        </div>
      )}

      {/* Market unwind (market owner) */}
      {canSeeMarket && lmsr && (
        <div>
          <p className="text-gray-400 text-[11px] mb-2">
            Market unwind: pause before resolving, close + withdraw fees after.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <StandardButton
              onClick={() => run(lmsr, 'pause', [], 'Market paused.')}
              disabled={busy || stage !== MarketStage.Running}
              className="rounded-full"
              backgroundColor="bg-white/10"
            >
              Pause
            </StandardButton>
            <StandardButton
              onClick={() => run(lmsr, 'resume', [], 'Market resumed.')}
              disabled={busy || stage !== MarketStage.Paused}
              className="rounded-full"
              backgroundColor="bg-white/10"
            >
              Resume
            </StandardButton>
            <StandardButton
              onClick={() => run(lmsr, 'close', [], 'Market closed — inventory returned to owner.')}
              disabled={busy || isClosed}
              className="rounded-full"
              backgroundColor="bg-white/10"
            >
              Close market
            </StandardButton>
            <StandardButton
              onClick={() => run(lmsr, 'withdrawFees', [], 'Fees withdrawn to owner.')}
              disabled={busy || !isClosed}
              className="rounded-full"
              backgroundColor="bg-white/10"
            >
              {marketFeesWei !== undefined
                ? `Withdraw fees (${fmt(Number(marketFeesWei) / Number(UNIT), 4)} WETH)`
                : 'Withdraw fees'}
            </StandardButton>
          </div>
        </div>
      )}

      {/* Resolution (oracle) */}
      {isOracle && ctf && lmsr && (
        <div>
          <p className="text-gray-400 text-[11px] mb-2">
            Resolution (oracle, one-shot): the market must be paused/closed first; conditionId is
            recomputed from (you, questionId, {numOutcomes}) and must match the market before
            anything is sent.
          </p>
          <label className="text-xs text-gray-400">questionId</label>
          <input
            type="text"
            value={questionId}
            onChange={(e) => setQuestionId(e.target.value.trim())}
            className="mt-1 mb-2 w-full px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs font-mono placeholder-gray-500"
          />
          {resolved ? (
            <p className="text-gray-500 text-xs">
              Already resolved — the payout vector is write-once.
            </p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from({ length: numOutcomes }, (_, i) => (
                <StandardButton
                  key={i}
                  onClick={() => resolveWinner(i)}
                  disabled={busy}
                  className="rounded-full"
                  backgroundColor="bg-white/10"
                >
                  Resolve #{i + 1} wins
                </StandardButton>
              ))}
              <StandardButton
                onClick={resolveNoWinner}
                disabled={busy}
                className="rounded-full"
                backgroundColor="bg-moon-orange"
              >
                No winner (refund 1/{numOutcomes})
              </StandardButton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
