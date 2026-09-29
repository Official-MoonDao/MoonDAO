import ConditionalTokensABI from 'const/abis/ConditionalTokens.json'
import DePrizeFeeRouterABI from 'const/abis/DePrizeFeeRouter.json'
import DePrizeRegistryABI from 'const/abis/DePrizeRegistry.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import {
  CONDITIONAL_TOKEN_ADDRESSES,
  DEPRIZE_FEE_ROUTER_ADDRESSES,
  DEPRIZE_REGISTRY_ADDRESSES,
  JBV5_TERMINAL_ADDRESS,
} from 'const/config'
import { ethers } from 'ethers'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, prepareContractCall, type Chain } from 'thirdweb'
import useSafe from '@/lib/safe/useSafe'
import {
  encodeContractCall,
  isAddressInList,
  safeTransactionUrl,
} from '@/lib/deprize/safeProposal'
import {
  OPEN_FIELD_TEAM_ID,
  getDePrizeQuestionId,
  getDePrizeRaceBinding,
} from '@/lib/deprize/competitions'
import {
  buildSupersededPayouts,
  DePrizeState,
  isTerminalState,
  MarketStage,
  UNIT,
} from '@/lib/deprize/constants'
import { fmtEthWithUsd } from '@/lib/deprize/format'
import { JB_PROJECTS_ADDRESS, useAllowanceOfParams } from '@/lib/deprize/juiceboxPayout'
import { outcomeWinnerNameAt } from '@/lib/deprize/outcomeName'
import { rpcRead } from '@/lib/deprize/read'
import { useDePrizePrizePool } from '@/lib/deprize/useDePrizePrizePool'
import { sendDePrizeTx } from '@/lib/deprize/tx'
import { useDePrizeChainGuard } from '@/lib/deprize/useDePrizeChainGuard'
import useETHPrice from '@/lib/etherscan/useETHPrice'
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
  jbProjectId?: bigint
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
  jbProjectId,
  onDone,
}: DePrizeAdminPanelProps) {
  const userAddress = account?.address
  const chainSlug = getChainSlug(chain)
  const registryAddress = DEPRIZE_REGISTRY_ADDRESSES[chainSlug] ?? ''
  const ctfAddress = CONDITIONAL_TOKEN_ADDRESSES[chainSlug] ?? ''
  const feeRouterAddress = DEPRIZE_FEE_ROUTER_ADDRESSES[chainSlug] ?? ''
  const seededQuestionId = getDePrizeQuestionId(chainSlug, deprizeId) ?? ''

  const [busy, setBusy] = useState(false)
  const { wrongNetwork, chainLabel, switching, switchToChain, blockedByNetwork } =
    useDePrizeChainGuard(chain)
  const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')
  const [isRegistryOwner, setIsRegistryOwner] = useState(false)
  const [routerOwned, setRouterOwned] = useState(false)
  const [isMarketController, setIsMarketController] = useState(false)
  const [isOracle, setIsOracle] = useState(false)
  const [operatorSafe, setOperatorSafe] = useState('')
  const [pendingRegistryOwner, setPendingRegistryOwner] = useState('')
  const [proposalUrl, setProposalUrl] = useState('')
  const [projectOwner, setProjectOwner] = useState('')
  const [prizeRecipient, setPrizeRecipient] = useState('')
  const [prizeAmountEth, setPrizeAmountEth] = useState('')
  const { queueSafeTx } = useSafe(operatorSafe, chain)
  const prizePool = useDePrizePrizePool(
    jbProjectId && jbProjectId > 0n ? Number(jbProjectId) : undefined,
    chain.id
  )
  // Sticky so editing the questionId away from a match doesn't unmount the
  // panel (and lose the input) before the user can correct it.
  const [oracleUnlocked, setOracleUnlocked] = useState(false)
  const [winnerTeamId, setWinnerTeamId] = useState<string>('')
  const [providerAddress, setProviderAddress] = useState('')
  const [questionId, setQuestionId] = useState(seededQuestionId)
  // SUPERSEDED lineage resolve: optional real entity (when tip settled via
  // field sentinel) + this generation's Open Field team id.
  const [winningEntityTeamId, setWinningEntityTeamId] = useState('')
  const raceBinding = getDePrizeRaceBinding(chainSlug, deprizeId)
  const defaultOpenField =
    raceBinding?.outcomes.find((o) => o.field)?.teamId ??
    (teamIds.some((id) => id === BigInt(OPEN_FIELD_TEAM_ID)) ? OPEN_FIELD_TEAM_ID : 0)
  const seededOpenFieldTeamId = defaultOpenField > 0 ? String(defaultOpenField) : ''
  const [openFieldTeamId, setOpenFieldTeamId] = useState(seededOpenFieldTeamId)

  // Re-seed editable resolve fields when navigating between DePrizes.
  useEffect(() => {
    setQuestionId(seededQuestionId)
    setOracleUnlocked(false)
    setWinningEntityTeamId('')
    setOpenFieldTeamId(seededOpenFieldTeamId)
  }, [seededQuestionId, seededOpenFieldTeamId, marketAddress, userAddress])

  useEffect(() => {
    if (isOracle) setOracleUnlocked(true)
  }, [isOracle])

  const registry = useMemo(
    () =>
      registryAddress
        ? getContract({ client, chain, address: registryAddress, abi: DePrizeRegistryABI as any })
        : undefined,
    [chain, registryAddress],
  )
  const lmsr = useMemo(
    () =>
      marketAddress
        ? getContract({ client, chain, address: marketAddress, abi: LMSRWithTWAP.abi as any })
        : undefined,
    [chain, marketAddress],
  )
  const ctf = useMemo(
    () =>
      ctfAddress
        ? getContract({ client, chain, address: ctfAddress, abi: ConditionalTokensABI as any })
        : undefined,
    [chain, ctfAddress],
  )
  const feeRouter = useMemo(
    () =>
      feeRouterAddress
        ? getContract({
            client,
            chain,
            address: feeRouterAddress,
            abi: DePrizeFeeRouterABI as any,
          })
        : undefined,
    [chain, feeRouterAddress],
  )

  // Registry owner — gates lifecycle controls.
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
        if (!cancelled) setIsRegistryOwner(owner.toLowerCase() === userAddress.toLowerCase())
      } catch {
        if (!cancelled) setIsRegistryOwner(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [registry, userAddress])

  // Market controller — FeeRouter owner when the router owns the LMSR, else
  // the LMSR owner directly. Also records whether calls must go through the
  // router passthroughs.
  useEffect(() => {
    if (!lmsr || !userAddress) {
      setRouterOwned(false)
      setIsMarketController(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const lmsrOwner = await rpcRead<string>({
          contract: lmsr,
          method: 'owner' as string,
          params: [],
        })
        const viaRouter =
          !!feeRouterAddress && lmsrOwner.toLowerCase() === feeRouterAddress.toLowerCase()
        if (cancelled) return
        setRouterOwned(viaRouter)
        if (viaRouter && feeRouter) {
          const routerOwner = await rpcRead<string>({
            contract: feeRouter,
            method: 'owner' as string,
            params: [],
          })
          if (!cancelled)
            setIsMarketController(routerOwner.toLowerCase() === userAddress.toLowerCase())
        } else {
          setIsMarketController(lmsrOwner.toLowerCase() === userAddress.toLowerCase())
        }
      } catch {
        if (!cancelled) {
          setRouterOwned(false)
          setIsMarketController(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lmsr, feeRouter, feeRouterAddress, userAddress])

  // Oracle — derived: keccak(user, questionId, numOutcomes) must equal the
  // market's conditionId. Re-runs when the editable questionId changes so an
  // oracle whose id isn't in the registry can paste it and unlock the section.
  useEffect(() => {
    if (!ctf || !lmsr || !userAddress || !questionId || numOutcomes <= 0) {
      setIsOracle(false)
      return
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(questionId)) {
      setIsOracle(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const marketConditionId = await rpcRead<string>({
          contract: lmsr,
          method: 'conditionIds' as string,
          params: [0n],
        })
        const candidates = [userAddress, operatorSafe].filter(Boolean)
        for (const who of candidates) {
          const computed = await rpcRead<string>({
            contract: ctf,
            method: 'getConditionId' as string,
            params: [who, questionId, BigInt(numOutcomes)],
          })
          if (computed.toLowerCase() === marketConditionId.toLowerCase()) {
            if (!cancelled) setIsOracle(true)
            return
          }
        }
        if (!cancelled) setIsOracle(false)
      } catch {
        if (!cancelled) setIsOracle(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ctf, lmsr, operatorSafe, userAddress, questionId, numOutcomes])

  // A signer of the Safe that owns the market (or is the pending registry
  // owner) can propose the same calls. The connected wallet is not the Safe,
  // so those calls cannot be sent directly.
  useEffect(() => {
    if (!userAddress) {
      setOperatorSafe('')
      setPendingRegistryOwner('')
      return
    }
    let cancelled = false
    const ownersAbi = [
      {
        type: 'function',
        name: 'getOwners',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address[]' }],
      },
    ] as const
    const ownableAbi = [
      {
        type: 'function',
        name: 'owner',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
      },
      {
        type: 'function',
        name: 'pendingOwner',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
      },
    ] as const
    const readOwners = async (address: string) => {
      const contract = getContract({ client, chain, address, abi: ownersAbi as any })
      return rpcRead<string[]>({ contract, method: 'getOwners' as string, params: [] })
    }
    ;(async () => {
      const candidates: string[] = []
      try {
        if (lmsr) {
          const lmsrOwner = await rpcRead<string>({
            contract: lmsr,
            method: 'owner' as string,
            params: [],
          })
          if (lmsrOwner) candidates.push(lmsrOwner)
        }
        if (registry) {
          const owner = await rpcRead<string>({
            contract: registry,
            method: 'owner' as string,
            params: [],
          })
          if (owner) candidates.push(owner)
          const ownable = getContract({
            client,
            chain,
            address: registry.address,
            abi: ownableAbi as any,
          })
          const pending = await rpcRead<string>({
            contract: ownable,
            method: 'pendingOwner' as string,
            params: [],
          }).catch(() => '')
          if (!cancelled) setPendingRegistryOwner(pending || '')
          if (pending) candidates.push(pending)
        }
      } catch {
        if (!cancelled) setOperatorSafe('')
        return
      }
      const seen = new Set<string>()
      for (const candidate of candidates) {
        const key = candidate.toLowerCase()
        if (!candidate || seen.has(key)) continue
        seen.add(key)
        try {
          const owners = await readOwners(candidate)
          if (isAddressInList(userAddress, owners || [])) {
            if (!cancelled) setOperatorSafe(candidate)
            return
          }
        } catch {
          /* not a Safe */
        }
      }
      if (!cancelled) setOperatorSafe('')
    })()
    return () => {
      cancelled = true
    }
  }, [chain, lmsr, registry, userAddress])

  useEffect(() => {
    if (!jbProjectId || jbProjectId <= 0n) {
      setProjectOwner('')
      return
    }
    let cancelled = false
    const projects = getContract({
      client,
      chain,
      address: JB_PROJECTS_ADDRESS,
      abi: [
        {
          type: 'function',
          name: 'ownerOf',
          stateMutability: 'view',
          inputs: [{ name: 'tokenId', type: 'uint256' }],
          outputs: [{ name: '', type: 'address' }],
        },
      ] as any,
    })
    rpcRead<string>({
      contract: projects,
      method: 'ownerOf' as string,
      params: [jbProjectId],
    })
      .then((owner) => {
        if (!cancelled) setProjectOwner(owner || '')
      })
      .catch(() => {
        if (!cancelled) setProjectOwner('')
      })
    return () => {
      cancelled = true
    }
  }, [chain, jbProjectId])

  const isSafeSigner = Boolean(operatorSafe)
  // Market unwind is visible to the controller; oracle also needs pause/close
  // before resolving, so show it to either role. A Safe signer proposes
  // instead of sending. Sweep is permissionless when router-owned.
  const canSeeMarket = isMarketController || isOracle || oracleUnlocked || isSafeSigner
  if (!userAddress || (!isRegistryOwner && !canSeeMarket)) return null

  // Generic write helper with a toast lifecycle.
  const proposeToSafe = async (contract: any, method: string, params: any[], doneMsg: string) => {
    const data = encodeContractCall(contract.abi as any, method, params)
    const safeTxHash = await queueSafeTx({
      to: contract.address,
      value: '0',
      data,
      operation: 0,
    })
    const url = safeTransactionUrl(chain.id, operatorSafe, safeTxHash)
    setProposalUrl(url)
    toast.success(`${doneMsg} Share the Safe link so the other signers can confirm.`, {
      style: toastStyle,
      duration: 8000,
    })
  }

  const run = async (contract: any, method: string, params: any[], doneMsg: string) => {
    if (!account || !contract) return
    if (blockedByNetwork()) return
    setBusy(true)
    try {
      if (isSafeSigner) {
        await proposeToSafe(contract, method, params, doneMsg)
      } else {
        await sendDePrizeTx(
          account,
          prepareContractCall({ contract, method: method as string, params }),
        )
        toast.success(doneMsg, { style: toastStyle })
        onDone()
      }
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

  const safeOwnsProject =
    isSafeSigner &&
    !!projectOwner &&
    projectOwner.toLowerCase() === operatorSafe.toLowerCase()
  const userOwnsProject =
    !!userAddress &&
    !!projectOwner &&
    userAddress.toLowerCase() === projectOwner.toLowerCase()
  const canSendPrize = safeOwnsProject || userOwnsProject

  const sendPrize = async () => {
    if (!jbProjectId || jbProjectId <= 0n || !canSendPrize) return
    if (blockedByNetwork()) return
    if (!/^0x[0-9a-fA-F]{40}$/.test(prizeRecipient)) {
      toast.error('Enter the winner address.', { style: toastStyle })
      return
    }
    let amountWei: bigint
    try {
      amountWei = BigInt(ethers.utils.parseEther(prizeAmountEth || '0').toString())
    } catch {
      toast.error('Enter an ETH amount.', { style: toastStyle })
      return
    }
    if (amountWei <= 0n) {
      toast.error('Enter an ETH amount.', { style: toastStyle })
      return
    }
    if (prizePool.balanceWei != null && amountWei > prizePool.balanceWei) {
      toast.error('That is more than the Juicebox balance.', { style: toastStyle })
      return
    }
    const terminal = getContract({
      client,
      chain,
      address: JBV5_TERMINAL_ADDRESS,
      abi: USE_ALLOWANCE_ABI as any,
    })
    const params = [...useAllowanceOfParams({
      projectId: jbProjectId,
      amountWei,
      beneficiary: prizeRecipient,
    })]
    setBusy(true)
    try {
      if (safeOwnsProject) {
        await proposeToSafe(terminal, 'useAllowanceOf', params, 'Prize payout proposed.')
      } else {
        await sendDePrizeTx(
          account,
          prepareContractCall({
            contract: terminal,
            method: 'useAllowanceOf' as string,
            params,
          }),
        )
        toast.success('Prize sent.', { style: toastStyle })
        onDone()
      }
    } catch (err: any) {
      console.error('[deprize-admin] useAllowanceOf failed', err)
      toast.error(err?.shortMessage || err?.message || 'Prize payout failed.', {
        style: toastStyle,
        duration: 8000,
      })
    } finally {
      setBusy(false)
    }
  }

  const S = DePrizeState
  // Mirrors DePrizeFeeRouter.sweepFees: prize pool only when non-terminal
  // and cancellation is not pending; otherwise treasury (router owner).
  const sweepToPrizePool = !isTerminalState(state) && !cancellationPending
  const sweepDestination = sweepToPrizePool ? 'prize pool' : 'treasury'

  // Oracle resolution with the same pre-flight as DePrizeResolve.s.sol.
  const resolve = async (payouts: bigint[], label: string) => {
    if (!account || !ctf || !lmsr) return
    if (blockedByNetwork()) return
    setBusy(true)
    try {
      const oracleAddress = isSafeSigner ? operatorSafe : account.address
      const computed = await rpcRead<string>({
        contract: ctf,
        method: 'getConditionId' as string,
        params: [oracleAddress, questionId, BigInt(numOutcomes)],
      })
      const marketConditionId = await rpcRead<string>({
        contract: lmsr,
        method: 'conditionIds' as string,
        params: [0n],
      })
      if (computed.toLowerCase() !== marketConditionId.toLowerCase()) {
        throw new Error(
          `Pre-flight: conditionId mismatch — keccak(yourAddress, questionId, ${numOutcomes}) != the market's condition. Check the question id and that you are the oracle.`,
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
        }),
      )
      if (freshStage !== MarketStage.Paused && freshStage !== MarketStage.Closed) {
        throw new Error(
          'Pre-flight: pause or close the market first — resolving a live market gives away free trades against the known outcome.',
        )
      }
      if (isSafeSigner) {
        await proposeToSafe(ctf, 'reportPayouts', [questionId, payouts], `Resolved: ${label}.`)
      } else {
        await sendDePrizeTx(
          account,
          prepareContractCall({
            contract: ctf,
            method: 'reportPayouts' as string,
            params: [questionId, payouts],
          }),
        )
        toast.success(`Resolved: ${label}.`, { style: toastStyle })
        onDone()
      }
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Resolve failed.', {
        style: toastStyle,
        duration: 10000,
      })
    } finally {
      setBusy(false)
    }
  }

  const resolveWinner = (winningIndex: number) => {
    if (state === S.SUPERSEDED) {
      toast.error(
        'Superseded generations must resolve via lineage (settling generation → named / Open Field / 1/N).',
        { style: toastStyle, duration: 8000 },
      )
      return
    }
    return resolve(
      Array.from({ length: numOutcomes }, (_, i) => (i === winningIndex ? 1n : 0n)),
      `${outcomeWinnerNameAt(raceBinding?.outcomes, teamIds, winningIndex)} wins`,
    )
  }
  const resolveNoWinner = () => {
    if (state === S.SUPERSEDED) {
      toast.error(
        'Superseded generations must resolve via lineage (settling generation → named / Open Field / 1/N).',
        { style: toastStyle, duration: 8000 },
      )
      return
    }
    return resolve(
      Array.from({ length: numOutcomes }, () => 1n),
      `no winner — every position refunds 1/${numOutcomes}`,
    )
  }

  // Walk supersededBy on-chain and map the tip onto this roster — same rules
  // as DePrizeResolve._fillSupersededPayouts.
  const resolveSuperseded = async () => {
    if (!registry) {
      toast.error('Registry unavailable.', { style: toastStyle })
      return
    }
    setBusy(true)
    try {
      let tip = deprizeId
      for (let i = 0; i < 64; i++) {
        const next = Number(
          await rpcRead<bigint | number>({
            contract: registry,
            method: 'supersededBy' as string,
            params: [BigInt(tip)],
          }),
        )
        if (!next) break
        tip = next
      }
      if (tip === deprizeId) {
        throw new Error('Lineage unresolved — no settling generation after this id.')
      }
      const tipDp = await rpcRead<any>({
        contract: registry,
        method: 'getDePrize' as string,
        params: [BigInt(tip)],
      })
      const tipState = Number(tipDp.state) as DePrizeState
      const tipWinningTeamId = BigInt(tipDp.winningTeamId ?? 0)
      const entityRaw = winningEntityTeamId.trim()
      const openRaw = openFieldTeamId.trim()
      const payouts = buildSupersededPayouts({
        teamIds,
        tipState,
        tipWinningTeamId,
        winningEntityTeamId: entityRaw ? BigInt(entityRaw) : 0n,
        openFieldTeamId: openRaw ? BigInt(openRaw) : 0n,
      })
      // Drop the busy flag before resolve() re-acquires it.
      setBusy(false)
      await resolve(payouts, `lineage from DePrize #${tip}`)
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Lineage resolve failed.', {
        style: toastStyle,
        duration: 10000,
      })
      setBusy(false)
    }
  }

  const isClosed = stage === MarketStage.Closed

  // Pause / resume / close: FeeRouter passthroughs when the router owns the
  // LMSR (otherwise the direct lmsr.* calls revert for everyone but the router).
  const pauseMarket = () =>
    routerOwned && feeRouter
      ? run(feeRouter, 'pauseMarket', [BigInt(deprizeId)], 'Market paused via FeeRouter.')
      : run(lmsr, 'pause', [], 'Market paused.')
  const resumeMarket = () =>
    routerOwned && feeRouter
      ? run(feeRouter, 'resumeMarket', [BigInt(deprizeId)], 'Market resumed via FeeRouter.')
      : run(lmsr, 'resume', [], 'Market resumed.')
  const closeMarket = () =>
    routerOwned && feeRouter
      ? run(
          feeRouter,
          'closeMarket',
          [BigInt(deprizeId)],
          'Market closed via FeeRouter — inventory returned to FeeRouter.',
        )
      : run(lmsr, 'close', [], 'Market closed — inventory returned to owner.')

  return (
    <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 flex flex-col gap-5">
      <p className="text-yellow-300 text-xs font-medium">
        Admin actions
        {isRegistryOwner ? ' · registry owner' : ''}
        {isSafeSigner ? ' · Safe signer' : ''}
        {isOracle ? ' · oracle' : ''}
        {isMarketController ? (routerOwned ? ' · fee-router owner' : ' · market owner') : ''}
      </p>
      {isSafeSigner && (
        <p className="text-gray-400 text-xs leading-relaxed">
          Actions are proposed to the executive Safe. Send the Safe link to the other
          signers. Three of four must confirm before it can execute.
        </p>
      )}
      {proposalUrl && (
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={proposalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
          >
            Open in Safe to collect signatures
          </a>
          <button
            type="button"
            className="text-xs text-gray-300 hover:text-white"
            onClick={() => {
              void navigator.clipboard.writeText(proposalUrl)
              toast.success('Safe link copied.', { style: toastStyle })
            }}
          >
            Copy link
          </button>
        </div>
      )}

      {wrongNetwork && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
          <p className="text-amber-200 text-sm">
            Your wallet is on a different network. Admin actions are sent on{' '}
            <span className="font-semibold">{chainLabel}</span>.
          </p>
          <StandardButton
            onClick={switchToChain}
            disabled={switching}
            className="rounded-full self-start"
            backgroundColor="bg-moon-green"
          >
            {switching ? 'Switching…' : `Switch wallet to ${chainLabel}`}
          </StandardButton>
        </div>
      )}

      {/* Registry lifecycle (registry owner) */}
      {(isRegistryOwner || isSafeSigner) && registry && (
        <div>
          <p className="text-gray-400 text-[11px] mb-2">DePrize lifecycle</p>
          <div className="flex items-center gap-2 flex-wrap">
            {isSafeSigner &&
              pendingRegistryOwner &&
              pendingRegistryOwner.toLowerCase() === operatorSafe.toLowerCase() && (
                <StandardButton
                  onClick={() =>
                    run(
                      getContract({
                        client,
                        chain,
                        address: registryAddress,
                        abi: [
                          {
                            type: 'function',
                            name: 'acceptOwnership',
                            stateMutability: 'nonpayable',
                            inputs: [],
                            outputs: [],
                          },
                        ] as any,
                      }),
                      'acceptOwnership',
                      [],
                      'Ownership acceptance proposed.',
                    )
                  }
                  disabled={busy}
                  className="rounded-full"
                  backgroundColor="bg-moon-green"
                >
                  Accept Safe ownership
                </StandardButton>
              )}
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
                onClick={() =>
                  run(registry, 'startVote', [BigInt(deprizeId)], 'Winner vote started.')
                }
                disabled={busy}
                className="rounded-full"
                backgroundColor="bg-white/10"
              >
                Start winner vote
              </StandardButton>
            )}
            {(state === S.LOCKED || state === S.VOTING) && (
              <StandardButton
                onClick={() =>
                  run(registry, 'settleNoWinner', [BigInt(deprizeId)], 'Settled: no winner.')
                }
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
                  onClick={() =>
                    run(registry, 'failM2', [BigInt(deprizeId)], 'M2 failed — refunds enabled.')
                  }
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
                  run(
                    registry,
                    'announceCancellation',
                    [BigInt(deprizeId)],
                    'Cancellation announced (7-day notice).',
                  )
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
                    {outcomeWinnerNameAt(raceBinding?.outcomes, teamIds, i)}
                  </option>
                ))}
              </select>
              <StandardButton
                onClick={() =>
                  run(
                    registry,
                    'settleWinner',
                    [BigInt(deprizeId), BigInt(winnerTeamId)],
                    'Winner declared.',
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
                    'Provider payout address set.',
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

      {jbProjectId && jbProjectId > 0n && (
        <JuiceboxPrizeSection
          busy={busy}
          balanceWei={prizePool.balanceWei}
          loading={prizePool.loading}
          projectId={jbProjectId}
          projectOwner={projectOwner}
          canSend={canSendPrize}
          recipient={prizeRecipient}
          amountEth={prizeAmountEth}
          onRecipient={setPrizeRecipient}
          onAmount={setPrizeAmountEth}
          onFillBalance={() => {
            if (prizePool.balanceWei != null) {
              setPrizeAmountEth(ethers.utils.formatEther(prizePool.balanceWei.toString()))
            }
          }}
          onSend={sendPrize}
        />
      )}

      {/* Market unwind — FeeRouter passthroughs when router-owned */}
      {canSeeMarket && lmsr && (
        <div>
          <p className="text-gray-400 text-[11px] mb-2">
            Market unwind
            {routerOwned
              ? ` (via FeeRouter — pause before resolving; sweep fees into the ${sweepDestination})`
              : ' (direct LMSR — pause before resolving, close + withdraw fees after)'}
            {!isMarketController && !isSafeSigner && isOracle
              ? ' · pause/close requires the fee-router or market owner'
              : ''}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <StandardButton
              onClick={pauseMarket}
              disabled={busy || (!isMarketController && !isSafeSigner) || stage !== MarketStage.Running}
              className="rounded-full"
              backgroundColor="bg-white/10"
            >
              Pause
            </StandardButton>
            <StandardButton
              onClick={resumeMarket}
              disabled={busy || (!isMarketController && !isSafeSigner) || stage !== MarketStage.Paused}
              className="rounded-full"
              backgroundColor="bg-white/10"
            >
              Resume
            </StandardButton>
            <StandardButton
              onClick={closeMarket}
              disabled={busy || (!isMarketController && !isSafeSigner) || isClosed}
              className="rounded-full"
              backgroundColor="bg-white/10"
            >
              Close market
            </StandardButton>
            {routerOwned && feeRouter ? (
              <StandardButton
                onClick={() =>
                  run(
                    feeRouter,
                    'sweepFees',
                    [BigInt(deprizeId)],
                    `Fees swept to the ${sweepDestination}.`,
                  )
                }
                // sweepFees is permissionless but returns 0 when the market
                // holds no WETH — don't spend gas on a known no-op.
                disabled={busy || marketFeesWei === 0n}
                className="rounded-full"
                backgroundColor="bg-white/10"
              >
                {marketFeesWei !== undefined
                  ? `Sweep fees (${fmtEthWithUsd(Number(marketFeesWei) / Number(UNIT), ethPrice, { decimals: 4, unit: 'WETH' })})`
                  : `Sweep fees to ${sweepDestination}`}
              </StandardButton>
            ) : (
              <StandardButton
                onClick={() => run(lmsr, 'withdrawFees', [], 'Fees withdrawn to owner.')}
                disabled={busy || (!isMarketController && !isSafeSigner) || !isClosed}
                className="rounded-full"
                backgroundColor="bg-white/10"
              >
                {marketFeesWei !== undefined
                  ? `Withdraw fees (${fmtEthWithUsd(Number(marketFeesWei) / Number(UNIT), ethPrice, { decimals: 4, unit: 'WETH' })})`
                  : 'Withdraw fees'}
              </StandardButton>
            )}
          </div>
        </div>
      )}

      {/* Resolution — shown when derived oracle check passes; questionId stays editable */}
      {ctf && lmsr && (
        <div>
          <p className="text-gray-400 text-[11px] mb-2">
            Resolution (oracle, one-shot): the market must be paused/closed first; conditionId is
            recomputed from (you, questionId, {numOutcomes}) and must match the market before
            anything is sent.
            {!isOracle
              ? ' Paste the condition’s questionId below — the resolve buttons appear when it matches.'
              : ''}
          </p>
          <label className="text-xs text-gray-400">questionId</label>
          <input
            type="text"
            value={questionId}
            onChange={(e) => setQuestionId(e.target.value.trim())}
            className="mt-1 mb-2 w-full px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs font-mono placeholder-gray-500"
          />
          {isOracle &&
            (resolved ? (
              <p className="text-gray-500 text-xs">
                Already resolved — the payout vector is write-once.
              </p>
            ) : state === S.SUPERSEDED ? (
              <div className="flex flex-col gap-2">
                <p className="text-amber-200/90 text-xs">
                  This generation is SUPERSEDED — payouts must follow the settling generation (named
                  slot, else Open Field, else 1/N). Do not submit a one-hot vector by outcome index.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs text-gray-400">
                    Winning entity team id (optional)
                    <input
                      type="text"
                      inputMode="numeric"
                      value={winningEntityTeamId}
                      onChange={(e) => setWinningEntityTeamId(e.target.value.trim())}
                      placeholder="0 = use tip winningTeamId"
                      className="w-48 px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs font-mono placeholder-gray-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-gray-400">
                    Open Field team id
                    <input
                      type="text"
                      inputMode="numeric"
                      value={openFieldTeamId}
                      onChange={(e) => setOpenFieldTeamId(e.target.value.trim())}
                      placeholder="0 if none"
                      className="w-40 px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs font-mono placeholder-gray-500"
                    />
                  </label>
                  <StandardButton
                    onClick={resolveSuperseded}
                    disabled={busy}
                    className="rounded-full"
                    backgroundColor="bg-moon-orange"
                  >
                    Resolve via lineage
                  </StandardButton>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: numOutcomes }, (_, i) => {
                  const name = outcomeWinnerNameAt(raceBinding?.outcomes, teamIds, i)
                  return (
                    <StandardButton
                      key={i}
                      onClick={() => resolveWinner(i)}
                      disabled={busy}
                      className="rounded-full"
                      backgroundColor="bg-white/10"
                    >
                      {name} wins
                    </StandardButton>
                  )
                })}
                <StandardButton
                  onClick={resolveNoWinner}
                  disabled={busy}
                  className="rounded-full"
                  backgroundColor="bg-moon-orange"
                >
                  No winner (refund 1/{numOutcomes})
                </StandardButton>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

const USE_ALLOWANCE_ABI = [
  {
    type: 'function',
    name: 'useAllowanceOf',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'currency', type: 'uint256' },
      { name: 'minTokensPaidOut', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
      { name: 'feeBeneficiary', type: 'address' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [{ name: 'netAmountPaidOut', type: 'uint256' }],
  },
] as const

function JuiceboxPrizeSection({
  busy,
  balanceWei,
  loading,
  projectId,
  projectOwner,
  canSend,
  recipient,
  amountEth,
  onRecipient,
  onAmount,
  onFillBalance,
  onSend,
}: {
  busy: boolean
  balanceWei: bigint | null
  loading: boolean
  projectId: bigint
  projectOwner: string
  canSend: boolean
  recipient: string
  amountEth: string
  onRecipient: (value: string) => void
  onAmount: (value: string) => void
  onFillBalance: () => void
  onSend: () => void
}) {
  const balanceLabel =
    loading || balanceWei == null ? '…' : `${ethers.utils.formatEther(balanceWei.toString())} ETH`
  return (
    <div>
      <p className="text-gray-400 text-[11px] mb-2">
        Juicebox prize pool · project {projectId.toString()} · {balanceLabel}
      </p>
      {projectOwner && (
        <p className="text-gray-500 text-[11px] mb-2 font-mono break-all">
          Owner {projectOwner}
        </p>
      )}
      {canSend ? (
        <div className="flex flex-col gap-2">
          <p className="text-gray-400 text-xs leading-relaxed">
            Sends ETH from the project surplus to a winner address. The locked
            payout split is not used, so the recipient does not have to be the
            project owner.
          </p>
          <input
            type="text"
            value={recipient}
            onChange={(e) => onRecipient(e.target.value.trim())}
            placeholder="Winner address (0x…)"
            className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs font-mono placeholder-gray-500"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              inputMode="decimal"
              value={amountEth}
              onChange={(e) => onAmount(e.target.value.trim())}
              placeholder="Amount in ETH"
              className="w-40 px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-white text-xs font-mono placeholder-gray-500"
            />
            <button
              type="button"
              className="text-xs text-indigo-300 hover:text-indigo-200"
              onClick={onFillBalance}
              disabled={balanceWei == null}
            >
              Use full balance
            </button>
            <StandardButton
              onClick={onSend}
              disabled={busy}
              className="rounded-full"
              backgroundColor="bg-moon-green"
            >
              Send prize
            </StandardButton>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-xs">
          The connected wallet cannot pay this project. The project owner has to
          send the surplus.
        </p>
      )}
    </div>
  )
}
