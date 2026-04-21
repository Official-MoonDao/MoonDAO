import confetti from 'canvas-confetti'
import DistributionTableABI from 'const/abis/DistributionTable.json'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import ProposalsABI from 'const/abis/Proposals.json'
import {
  DEFAULT_CHAIN_V5,
  DISTRIBUTION_TABLE_ADDRESSES,
  DISTRIBUTION_TABLE_NAMES,
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  PROPOSALS_ADDRESSES,
  PROPOSALS_TABLE_NAMES,
  ARBITRUM_ASSETS_URL,
  POLYGON_ASSETS_URL,
  BASE_ASSETS_URL,
  USD_BUDGET,
  IS_SENATE_VOTE,
  IS_MEMBER_VOTE,
  IS_REWARDS_CYCLE,
  RETRO_PAYOUT_TOKEN,
  RETRO_ETH_BUDGET,
} from 'const/config'
import useStakedEth from 'lib/utils/hooks/useStakedEth'
import _ from 'lodash'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  readContract,
  sendTransaction,
  waitForReceipt,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useCitizens } from '@/lib/citizen/useCitizen'
import { useAssets } from '@/lib/dashboard/hooks'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { Project } from '@/lib/project/useProjectData'
import { ethereum } from '@/lib/rpc/chains'
import useWindowSize from '@/lib/team/use-window-size'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVP, useTotalVPs } from '@/lib/tokens/hooks/useTotalVP'
import {
  getRelativeQuarter,
  isRewardsCycle,
  isApprovalActive,
  getSubmissionQuarter,
} from '@/lib/utils/dates'
import { getBudget, getPayouts, computeRewardPercentages } from '@/lib/utils/rewards'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import Modal from '@/components/layout/Modal'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import StandardButtonRight from '@/components/layout/StandardButtonRight'
import Tooltip from '@/components/layout/Tooltip'
import OperatorPanel from '@/components/operator/OperatorPanel'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import PastProjects, { hasFinalReport } from '@/components/project/PastProjects'
import ProjectCard from '@/components/project/ProjectCard'
import RewardAsset from '@/components/project/RewardAsset'

export type Distribution = {
  year: number
  quarter: number
  address: string
  distribution: { [key: string]: number }
}

export type ProjectRewardsProps = {
  proposals: Project[]
  currentProjects: Project[]
  pastProjects: Project[]
  distributions: Distribution[]
  proposalAllocations?: Distribution[]
  refreshRewards: () => void
}

// The `distribution` column on both Tableland tables is stored via
// `json(...)` in the smart contract. Depending on the read path (SDK vs
// gateway / which validator returns the row first) it can come back as a
// parsed object OR as a raw JSON string. Treat both shapes as valid so a
// previously-submitted distribution always pre-populates correctly.
function parseDistribution(raw: any): Record<string, number> {
  if (!raw) return {}
  if (typeof raw === 'object') {
    return raw as Record<string, number>
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

// Hit the Tableland API to verify whether the connected wallet already has a
// row for the given (quarter, year) — used right before submitting so we can
// pick `insertIntoTable` vs `updateTableCol` based on the actual on-chain
// table state rather than the (potentially stale) `getStaticProps` cache.
//
// Returns:
//   true  → row exists, must use updateTableCol
//   false → no row, must use insertIntoTable
//   null  → query failed; caller should fall back to its cached flag
async function fetchExistingRowExists(
  tableName: string | undefined,
  quarter: number,
  year: number,
  address: string
): Promise<boolean | null> {
  if (!tableName || !address) return null
  try {
    const lower = address.toLowerCase()
    const statement = `SELECT id FROM ${tableName} WHERE quarter = ${quarter} AND year = ${year} AND address = '${lower}' LIMIT 1`
    // Cache-bust the API so we never hit the 30s CDN cache for this check.
    const url = `/api/tableland/query?statement=${encodeURIComponent(
      statement
    )}&_t=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows.length > 0
  } catch (err) {
    console.warn('Pre-submit existence check failed:', err)
    return null
  }
}

// Pull a human-readable reason out of a thirdweb / wallet / RPC error so the
// user (and we) can tell why a submission failed instead of always seeing the
// same generic toast.
function formatTxError(error: any): string {
  if (!error) return 'Unknown error.'
  const message: string =
    typeof error?.message === 'string' ? error.message : String(error)

  if (
    error?.code === 4001 ||
    /user rejected|user denied|rejected the request/i.test(message)
  ) {
    return 'Transaction was cancelled in your wallet.'
  }

  if (/insufficient funds/i.test(message)) {
    return 'Insufficient funds to cover gas. Please top up and try again.'
  }

  if (/nonce too low|replacement transaction underpriced/i.test(message)) {
    return 'Wallet nonce mismatch — refresh the page and try again.'
  }

  const revertReason: string | undefined =
    error?.reason ||
    error?.shortMessage ||
    error?.cause?.shortMessage ||
    error?.cause?.reason ||
    (typeof error?.data?.message === 'string' ? error.data.message : undefined)
  if (revertReason && typeof revertReason === 'string') {
    return `Transaction reverted: ${revertReason}`
  }

  if (/timeout|timed out|took too long/i.test(message)) {
    return 'Transaction timed out waiting for confirmation. Check your wallet for status.'
  }

  if (/fetch failed|network request failed|network error/i.test(message)) {
    return 'Network error while submitting. Please try again.'
  }

  return message.length > 240 ? `${message.slice(0, 240)}…` : message
}

// Send the prepared transaction once, then poll for its receipt with a few
// retries so a flaky RPC during the *confirmation* step doesn't make the user
// re-sign and double-broadcast. We never re-send the transaction itself —
// once `sendTransaction` returns a hash, the tx is in the mempool and we
// only retry the receipt fetch.
async function sendTxAndWaitWithRetry({
  transaction,
  account,
  chain,
  client,
  receiptAttempts = 3,
}: {
  transaction: any
  account: any
  chain: any
  client: any
  receiptAttempts?: number
}) {
  const sent = await sendTransaction({ transaction, account })
  const transactionHash = sent.transactionHash

  let lastError: unknown
  for (let attempt = 0; attempt < receiptAttempts; attempt++) {
    try {
      const receipt = await waitForReceipt({
        client,
        chain,
        transactionHash,
      })
      return receipt
    } catch (err) {
      lastError = err
      if (attempt < receiptAttempts - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
      }
    }
  }
  throw lastError
}

// Helper function to format large numbers for mobile display
export function ProjectRewards({
  proposals,
  currentProjects,
  pastProjects,
  distributions,
  proposalAllocations,
  refreshRewards,
}: ProjectRewardsProps) {
  const router = useRouter()

  const chain = DEFAULT_CHAIN_V5
  const { isMobile } = useWindowSize()
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const userAddress = account?.address

  const [rewardVotingActive, setRewardVotingActive] = useState(IS_REWARDS_CYCLE)
  const [approvalVotingActive, setApprovalVotingActive] = useState(false)
  const isSenateVote = IS_SENATE_VOTE
  const isMemberVote = IS_MEMBER_VOTE
  const { quarter, year } = getRelativeQuarter(rewardVotingActive ? -1 : 0)
  const { quarter: currentQuarter, year: currentYear } = getRelativeQuarter(0)
  const { quarter: submissionQuarter, year: submissionYear } = getSubmissionQuarter()

  const [edit, setEdit] = useState(false)
  const [distribution, setDistribution] = useState<{ [key: string]: number }>({})
  const [originalDistribution, setOriginalDistribution] = useState<{ [key: string]: number }>({})

  type ProjectTab = 'proposals' | 'active' | 'retroactive' | 'past'
  const hasProposals = !!proposals?.length
  const initialTab: ProjectTab = hasProposals
    ? 'proposals'
    : currentProjects?.length
    ? 'active'
    : 'past'
  const [activeTab, setActiveTab] = useState<ProjectTab>(initialTab)
  
  // Separate state for proposal allocations
  const [proposalEdit, setProposalEdit] = useState(false)
  const [proposalDistribution, setProposalDistribution] = useState<{ [key: string]: number }>({})
  const [originalProposalDistribution, setOriginalProposalDistribution] = useState<{ [key: string]: number }>({})

  // Equal-weight confirmation modal. We open this when a member tries to
  // submit a vote that gives every scored proposal the exact same weight,
  // since mathematically that produces the same outcome as not voting at
  // all (no signal about which projects matter more). The user can either
  // back out and re-allocate, or acknowledge and continue anyway.
  const [equalWarningOpen, setEqualWarningOpen] = useState(false)
  // When the user confirms the equal-weight warning we re-invoke the
  // submit handler from outside `PrivyWeb3Button`, so its internal
  // `isLoading` state never flips. This external flag drives a matching
  // spinner/disabled state on the Submit Distribution button so the user
  // still gets the "Check your wallet…" affordance after acknowledging.
  const [proposalSubmitting, setProposalSubmitting] = useState(false)

  // ---------------------------------------------------------------------------
  // Valid project-id sets used to scope distributions / proposal allocations
  // to the slate that's *currently* on screen. Stored allocations from past
  // cycles can include keys that are no longer in the current proposals or
  // eligible-projects list; those orphan keys would otherwise inflate the
  // displayed Allocated% and silently hitch a ride on submits.
  //
  // - validProposalIds → ids of proposals visible in the member-vote tab.
  // - validEligibleIds → ids of eligible projects in the retroactive tab.
  // ---------------------------------------------------------------------------
  const validProposalIds = useMemo(() => {
    if (!proposals?.length) return new Set<string>()
    let visible = proposals
    if (IS_SENATE_VOTE) {
      visible = proposals.filter(
        (p: any) => !p.tempCheckApproved && !p.tempCheckFailed
      )
    } else if (IS_MEMBER_VOTE) {
      visible = proposals.filter(
        (p: any) => p.tempCheckApproved && !p.tempCheckFailed
      )
    } else {
      visible = proposals.filter((p: any) => !p.tempCheckFailed)
    }
    return new Set(visible.map((p: any) => String(p.id)))
  }, [proposals])

  const validEligibleIds = useMemo(() => {
    if (!currentProjects?.length) return new Set<string>()
    return new Set(
      currentProjects
        .filter((p: any) => p.eligible)
        .map((p: any) => String(p.id))
    )
  }, [currentProjects])

  // Helper: keep only the entries whose key appears in `validKeys`. Used to
  // strip orphan project ids from a distribution loaded out of the
  // distributions / proposalAllocations table.
  const filterToKeys = (
    dist: Record<string, number> | undefined | null,
    validKeys: Set<string>
  ): Record<string, number> => {
    if (!dist) return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(dist)) {
      if (validKeys.has(k)) out[k] = v as number
    }
    return out
  }

  // Proposals contract owner (only they can close voting)
  const [proposalsContractOwner, setProposalsContractOwner] = useState<string | null>(null)

  //Check if its the approval cycle
  useEffect(() => {
    setApprovalVotingActive(isApprovalActive(new Date()))
    const interval = setInterval(() => {
      setApprovalVotingActive(isApprovalActive(new Date()))
    }, 30000)
    return () => clearInterval(interval)
  })

  //Check if its the rewards cycle. `IS_REWARDS_CYCLE` (config) acts as a
  // force-on switch; otherwise we fall through to the date-based default.
  useEffect(() => {
    let cancelled = false

    const update = () => {
      if (cancelled) return
      setRewardVotingActive(isRewardsCycle(new Date(), IS_REWARDS_CYCLE))
    }

    update()
    const updateInterval = setInterval(update, 30000)
    return () => {
      cancelled = true
      clearInterval(updateInterval)
    }
  }, [])

  // Check if the user already has a distribution for the current quarter.
  // We prune the loaded distribution to the set of project IDs that are
  // actually eligible right now — otherwise stale entries from a previous
  // cycle become invisible "orphan" keys that inflate the displayed
  // Allocated% and get re-submitted on edit. We still flag `edit=true` if a
  // row exists for this quarter, so the submit path correctly does an
  // UPDATE (not INSERT, which would violate the unique(quarter,year,addr)
  // constraint).
  useEffect(() => {
    if (distributions && userAddress) {
      for (const d of distributions) {
        if (
          Number(d?.year) === year &&
          Number(d?.quarter) === quarter &&
          typeof d?.address === 'string' &&
          d.address.toLowerCase() === userAddress.toLowerCase()
        ) {
          const parsed = parseDistribution(d.distribution)
          const pruned = filterToKeys(parsed, validEligibleIds)
          if (Object.keys(pruned).length > 0) {
            setDistribution(pruned)
            setOriginalDistribution(pruned)
          }
          setEdit(true)
          break
        }
      }
    }
  }, [userAddress, distributions, quarter, year, validEligibleIds])

  // Pull the connected wallet's *own* member-vote row directly from
  // Tableland. The `proposalAllocations` prop is filled in by
  // `getStaticProps` with `revalidate: 60`, which means a vote the user
  // submitted moments ago can still be missing from the prop for up to a
  // minute. Hitting the API client-side gets us the freshest version and
  // makes the "Edit Distribution" + pre-populated values appear as soon
  // as the row exists on chain.
  const proposalAllocationStatement = useMemo(() => {
    const tableName = PROPOSALS_TABLE_NAMES[chainSlug]
    if (!tableName || !userAddress) return null
    return `SELECT * FROM ${tableName} WHERE quarter = ${submissionQuarter} AND year = ${submissionYear} AND address = '${userAddress.toLowerCase()}' LIMIT 1`
  }, [chainSlug, userAddress, submissionQuarter, submissionYear])

  const { data: freshProposalAllocations } = useTablelandQuery(
    proposalAllocationStatement,
    { revalidateOnFocus: true }
  )

  // Check if the user already has a proposal allocation for the *submission*
  // quarter (the quarter the proposals being voted on belong to). NOTE: do
  // NOT use `year`/`quarter` here — those are shifted to the prior quarter
  // during the retroactive-rewards window, and reusing them caused old
  // member-vote rows from the previous quarter to be surfaced as if the user
  // had already submitted this quarter's distribution.
  //
  // We prefer the freshly-fetched client-side row (if available) over the
  // potentially-stale `proposalAllocations` prop. The pruning step keeps
  // things honest if the loaded row contains keys for proposals that have
  // since moved out of the active member-vote slate — those orphan keys
  // would otherwise inflate the displayed Allocated% and slip back into
  // the next submit. We still flag `edit=true` whenever a row exists for
  // this (quarter, year, wallet) so the submit path correctly chooses
  // UPDATE (and respects the unique(quarter, year, address) constraint).
  useEffect(() => {
    if (!userAddress) return

    const candidates: any[] = []
    if (
      Array.isArray(freshProposalAllocations) &&
      freshProposalAllocations.length > 0
    ) {
      candidates.push(...freshProposalAllocations)
    } else if (proposalAllocations?.length) {
      candidates.push(...proposalAllocations)
    }

    for (const d of candidates) {
      if (
        Number(d?.year) === submissionYear &&
        Number(d?.quarter) === submissionQuarter &&
        typeof d?.address === 'string' &&
        d.address.toLowerCase() === userAddress.toLowerCase()
      ) {
        const parsed = parseDistribution(d.distribution)
        const pruned = filterToKeys(parsed, validProposalIds)
        if (Object.keys(pruned).length > 0) {
          setProposalDistribution(pruned)
          setOriginalProposalDistribution(pruned)
        }
        setProposalEdit(true)
        return
      }
    }
  }, [
    userAddress,
    freshProposalAllocations,
    proposalAllocations,
    submissionQuarter,
    submissionYear,
    validProposalIds,
  ])

  // Build project id -> author address for member vote (exclude own proposal from allocation)
  const [projectIdToAuthorAddress, setProjectIdToAuthorAddress] = useState<Record<string, string>>(
    {}
  )
  useEffect(() => {
    if (!proposals?.length) {
      setProjectIdToAuthorAddress({})
      return
    }

    const controller = new AbortController()
    const { signal } = controller

    const fetchAll = async () => {
      const results = await Promise.allSettled(
        proposals.map(async (project) => {
          if (!project.proposalIPFS) return null
          try {
            const res = await fetch(project.proposalIPFS, { signal })
            const json = await res.json()
            if (!json.authorAddress) return null
            return [String(project.id), json.authorAddress] as const
          } catch {
            // ignore fetch errors (including aborts)
            return null
          }
        })
      )

      const map: Record<string, string> = {}
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const [id, authorAddress] = result.value
          map[id] = authorAddress
        }
      }

      if (!signal.aborted) {
        setProjectIdToAuthorAddress(map)
      }
    }

    fetchAll()

    return () => {
      controller.abort()
    }
  }, [proposals])

  const tallyVotes = async () => {
    const res = await fetch(`/api/proposals/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Important: Specify the content type
      },
      body: JSON.stringify({
        quarter: submissionQuarter,
        year: submissionYear,
      }),
    })
    const resJson = await res.json()
    console.log('res', resJson)
  }

  const handleDistributionChange = (projectId: string, value: number) => {
    const newValue = Math.min(100, Math.max(0, +value))
    setDistribution((prev) => ({
      ...prev,
      [projectId]: newValue,
    }))
  }

  const handleProposalDistributionChange = (projectId: string, value: number) => {
    const newValue = Math.min(100, Math.max(0, +value))
    setProposalDistribution((prev) => ({
      ...prev,
      [projectId]: newValue,
    }))
  }

  //Contracts
  const projectContract = useContract({
    address: PROJECT_ADDRESSES[chainSlug],
    chain: chain,
    abi: ProjectABI as any,
  })
  const distributionTableContract = useContract({
    address: DISTRIBUTION_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: DistributionTableABI as any,
  })
  const proposalContract = useContract({
    address: PROPOSALS_ADDRESSES[chainSlug],
    chain: chain,
    abi: ProposalsABI.abi as any,
  })

  // Fetch Proposals contract owner so we only show "Close voting" to the owner
  useEffect(() => {
    if (!proposalContract) return

    let isCancelled = false

    readContract({
      contract: proposalContract,
      method: 'function owner() view returns (address)',
      params: [],
    })
      .then((result: unknown) => {
        if (isCancelled) return
        const owner =
          typeof result === 'string'
            ? result
            : Array.isArray(result)
            ? result[0]
            : null
        setProposalsContractOwner(owner != null ? String(owner).toLowerCase() : null)
      })
      .catch((err: unknown) => {
        if (isCancelled) return
        console.error(
          '[ProjectRewards] Proposals contract owner() read failed:',
          err
        )
        setProposalsContractOwner(null)
      })

    return () => {
      isCancelled = true
    }
  }, [proposalContract])

  const isProposalsContractOwner =
    !!userAddress &&
    !!proposalsContractOwner &&
    userAddress.toLowerCase() === proposalsContractOwner

  const hatsContract = useContract({
    address: HATS_ADDRESS,
    chain: chain,
    abi: HatsABI as any,
  })

  const addresses = useMemo(() => {
    return distributions ? distributions.map((d) => d.address) : []
  }, [distributions])

  const { walletVPs: _vps } = useTotalVPs(addresses)
  const addressToQuadraticVotingPower = Object.fromEntries(
    addresses.map((address, index) => [address, _vps[index]])
  )
  const votingPowerSumIsNonZero = _.sum(Object.values(addressToQuadraticVotingPower)) > 0
  const { walletVP: userVotingPower } = useTotalVP(userAddress || '')
  const userHasVotingPower = useMemo(() => {
    return userAddress && (userVotingPower ?? 0) > 0
  }, [userVotingPower, userAddress])

  const isCitizenAddresses = useCitizens(chain, addresses)
  const citizenVotingAddresses = [
    '0x78176eaabcb3255e898079dc67428e15149cdc99', // payout for ryand2d.eth
    '0x9fdf876a50ea8f95017dcfc7709356887025b5bb', // payout for mitchmcquinn.eth
  ]
  const isCitizenVotingAddresses = addresses.map((address) =>
    citizenVotingAddresses.includes(address.toLowerCase())
  )
  const isCitizens = isCitizenAddresses.map(
    (isCitizen, i) => isCitizen || isCitizenVotingAddresses[i]
  )

  let citizenDistributions = distributions?.filter((_, i) => isCitizens[i])
  const nonCitizenDistributions = distributions?.filter((_, i) => !isCitizens[i])

  const eligibleProjects = useMemo(
    () => currentProjects.filter((p) => p.eligible),
    [currentProjects]
  )

  const ineligibleProjects = useMemo(
    () => currentProjects.filter((p) => !p.eligible),
    [currentProjects]
  )
  // All projects need at least one citizen distribution to do iterative normalization
  const allProjectsHaveCitizenDistribution = eligibleProjects?.every(({ id }) =>
    citizenDistributions.some(({ distribution }) => id in distribution)
  )
  const allProjectsHaveRewardDistribution = eligibleProjects?.every(
    (project) => project.rewardDistribution !== undefined
  )
  // Map from address to percentage of commnity rewards
  const communityCircle = {}
  const communityCirclePopulated = Object.keys(communityCircle).length > 0
  const readyToRunVoting =
    allProjectsHaveCitizenDistribution &&
    allProjectsHaveRewardDistribution &&
    communityCirclePopulated
  const projectIdToEstimatedPercentage: { [key: string]: number } = readyToRunVoting
    ? computeRewardPercentages(
        citizenDistributions,
        nonCitizenDistributions,
        eligibleProjects,
        addressToQuadraticVotingPower
      )
    : {}

  const { tokens: mainnetTokens } = useAssets()
  const { tokens: arbitrumTokens } = useAssets(ARBITRUM_ASSETS_URL)
  const { tokens: polygonTokens } = useAssets(POLYGON_ASSETS_URL)
  const { tokens: baseTokens } = useAssets(BASE_ASSETS_URL)
  const { stakedEth, error } = useStakedEth()

  // Memoize the tokens array to prevent unnecessary re-renders
  const tokens = useMemo(() => {
    return mainnetTokens
      .concat(arbitrumTokens)
      .concat(polygonTokens)
      .concat(baseTokens)
      .filter((token: any) => token.usd > 1)
      .concat([{ symbol: 'stETH', balance: stakedEth }])
  }, [mainnetTokens, arbitrumTokens, polygonTokens, baseTokens, stakedEth])
  const totalAllocated = _.sum(Object.values(distribution))

  // The quarterly USD budget is the value of all non-mooney tokens in the treasury
  // calculated in USD on the first day of the quarter. This function calculates in
  // real time. To get the budget we run this on the first day of the quarter, and
  // then hard code it below.
  const {
    usdBudget: usdBudgetCurrent,
    mooneyBudget,
    ethPrice,
  } = useMemo(() => getBudget(tokens, year, quarter), [tokens, year, quarter])
  // 2025q4

  // For Q4 2025 retroactives we pay in ETH instead of USDC. The on-chain CSV
  // generated by getPayouts already uses `native,,address,amount` rows, which
  // means ETH on Arbitrum — so the only thing that changes vs the prior USDC
  // cycles is the budget magnitude and the displayed unit.
  const isEthPayoutCycle = RETRO_PAYOUT_TOKEN === 'ETH'
  const retroPrimaryBudget = isEthPayoutCycle ? RETRO_ETH_BUDGET : USD_BUDGET
  const retroPrimaryAssetName = isEthPayoutCycle ? 'ETH' : 'USDC'
  const retroPrimaryBudgetUsdValue = isEthPayoutCycle
    ? RETRO_ETH_BUDGET * (ethPrice || 0)
    : USD_BUDGET

  const usdBudget = USD_BUDGET

  // MOONEY budget for the *current* proposal quarter (used by the Project
  // Proposals tab header). When the retro-cycle override is on, `quarter`
  // shifts back to the prior quarter — that gives the correct retro pool but
  // the wrong number for the upcoming-proposals view.
  const { mooneyBudget: proposalsMooneyBudget } = useMemo(
    () => getBudget(tokens, currentYear, currentQuarter),
    [tokens, currentYear, currentQuarter]
  )

  // Cache the live MOONEY/USD price so we can convert both the retro and the
  // proposal-cycle MOONEY budgets without firing two parallel fetches.
  const [mooneyPriceUSD, setMooneyPriceUSD] = useState(0)
  const mooneyBudgetUSD = mooneyBudget * mooneyPriceUSD
  const proposalsMooneyBudgetUSD = proposalsMooneyBudget * mooneyPriceUSD

  const {
    addressToUsdPayout,
    addressToMooneyPayout,
    usdPayoutCSV,
    humanFormat,
    vMooneyAddresses,
    vMooneyAmounts,
  } = getPayouts(
    projectIdToEstimatedPercentage,
    eligibleProjects,
    communityCircle,
    retroPrimaryBudget,
    mooneyBudget
  )

  useEffect(() => {
    let isCancelled = false

    async function fetchMooneyPrice() {
      try {
        const response = await fetch('/api/mooney/price')
        if (!response.ok) throw new Error('Failed to fetch MOONEY price')
        const data = await response.json()
        const price = data.result?.price || 0
        if (!isCancelled && price > 0) setMooneyPriceUSD(price)
      } catch (error) {
        console.error('Error fetching MOONEY price:', error)
        if (!isCancelled) setMooneyPriceUSD(0)
      }
    }

    fetchMooneyPrice()
    return () => {
      isCancelled = true
    }
  }, [])

  const handleSubmit = async (contract: any) => {
    // Strip any orphan keys (project ids no longer in the eligible set)
    // before validating, comparing, or sending — see filterToKeys note above.
    const scopedDistribution = filterToKeys(distribution, validEligibleIds)
    const scopedOriginalDistribution = filterToKeys(
      originalDistribution,
      validEligibleIds
    )
    const totalPercentage = Object.values(scopedDistribution).reduce(
      (sum, value) => sum + value,
      0
    )
    if (totalPercentage !== 100) {
      toast.error('Total distribution must equal 100%.', {
        style: toastStyle,
      })
      return
    }
    if (edit && _.isEqual(scopedDistribution, scopedOriginalDistribution)) {
      toast.error('No changes detected. Please modify your distribution before resubmitting.', {
        style: toastStyle,
      })
      return
    }
    try {
      if (!account) throw new Error('No account found')
      // Re-check whether a row already exists for this wallet/quarter right
      // before we sign. If `getStaticProps` was cached before the user's
      // last submit, `edit` may still be `false` and we'd otherwise call
      // `insertIntoTable`, which Tableland silently rejects on the unique
      // constraint. Falling back to the cached `edit` flag if the lookup
      // itself fails keeps us no worse off than before.
      const distributionTableName = DISTRIBUTION_TABLE_NAMES[chainSlug]
      const freshExists = await fetchExistingRowExists(
        distributionTableName,
        quarter,
        year,
        account.address
      )
      const isEdit = freshExists ?? edit

      const method = isEdit ? 'updateTableCol' : 'insertIntoTable'
      const transaction = prepareContractCall({
        contract: contract,
        method: method as string,
        params: [quarter, year, JSON.stringify(scopedDistribution)],
      })
      const receipt = await sendTxAndWaitWithRetry({
        transaction,
        account,
        chain: contract.chain,
        client: contract.client,
      })
      if (receipt) {
        toast.success('Distribution submitted successfully!', {
          style: toastStyle,
        })
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          shapes: ['circle', 'star'],
          colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
        })
        setTimeout(
          () =>
            router.push(
              `/projects/thank-you?quarter=${quarter}&year=${year}&type=retro`
            ),
          3000
        )
      }
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error(formatTxError(error), {
        style: toastStyle,
        duration: 6000,
      })
    }
  }

  const handleProposalSubmit = async (
    contract: any,
    opts: { bypassEqualCheck?: boolean } = {}
  ) => {
    // Scope to the proposals currently visible in this voting tab, then
    // compare against the (also-scoped) original to keep the edit-detection
    // honest if the loaded row contained orphan keys from a previous cycle.
    const scopedProposalDistribution = filterToKeys(
      proposalDistribution,
      validProposalIds
    )
    const scopedOriginalProposalDistribution = filterToKeys(
      originalProposalDistribution,
      validProposalIds
    )
    const totalPercentage = Object.values(scopedProposalDistribution).reduce(
      (sum, value) => sum + value,
      0
    )
    if (totalPercentage !== 100) {
      toast.error('Total distribution must equal 100%.', {
        style: toastStyle,
      })
      return
    }
    if (
      proposalEdit &&
      _.isEqual(scopedProposalDistribution, scopedOriginalProposalDistribution)
    ) {
      toast.error('No changes detected. Please modify your distribution before resubmitting.', {
        style: toastStyle,
      })
      return
    }
    // If every scored proposal gets the same weight, the vote is
    // mathematically a no-op — surface a confirmation prompt before
    // burning a transaction on it. The modal calls back into this
    // function with `bypassEqualCheck: true` if the user opts to proceed.
    if (!opts.bypassEqualCheck) {
      const nonZeroValues = Object.values(scopedProposalDistribution).filter(
        (v) => v > 0
      )
      if (nonZeroValues.length > 1 && new Set(nonZeroValues).size === 1) {
        setEqualWarningOpen(true)
        return
      }
    }
    // Exclude projects where the user is the author (they cannot vote on their own proposal)
    const userAddr = userAddress?.toLowerCase()
    const distributionToSubmit: Record<string, number> = {}
    for (const [projectId, value] of Object.entries(scopedProposalDistribution)) {
      const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
      if (author && author === userAddr) continue
      distributionToSubmit[projectId] = value
    }
    // Normalize to 100% if we removed any author projects
    const sum = _.sum(Object.values(distributionToSubmit))
    if (sum <= 0) {
      toast.error('Allocate to at least one project you did not author.', {
        style: toastStyle,
      })
      return
    }
    const normalizedDistribution: Record<string, number> = {}
    for (const [projectId, value] of Object.entries(distributionToSubmit)) {
      normalizedDistribution[projectId] = Math.round((value / sum) * 1000) / 10
    }
    // Ensure rounding doesn't leave us off 100
    const normalizedSum = _.sum(Object.values(normalizedDistribution))
    if (normalizedSum !== 100 && Object.keys(normalizedDistribution).length > 0) {
      const firstId = Object.keys(normalizedDistribution)[0]
      normalizedDistribution[firstId] =
        Math.round((normalizedDistribution[firstId] + (100 - normalizedSum)) * 10) / 10
    }
    try {
      if (!account) throw new Error('No account found')
      // Member-vote proposal allocations are keyed by the *submission* quarter
      // (the quarter the proposals being voted on belong to), not the
      // rewards-shifted `quarter`/`year` used for retroactive distributions.
      //
      // Refresh the existence check against Tableland directly so a stale
      // `proposalEdit` flag (from a cached `getStaticProps`) doesn't push us
      // into `insertIntoTable` when an `updateTableCol` is actually required.
      const proposalsTableName = PROPOSALS_TABLE_NAMES[chainSlug]
      const freshExists = await fetchExistingRowExists(
        proposalsTableName,
        submissionQuarter,
        submissionYear,
        account.address
      )
      const isEdit = freshExists ?? proposalEdit

      const method = isEdit ? 'updateTableCol' : 'insertIntoTable'
      const transaction = prepareContractCall({
        contract: contract,
        method: method as string,
        params: [submissionQuarter, submissionYear, JSON.stringify(normalizedDistribution)],
      })
      const receipt = await sendTxAndWaitWithRetry({
        transaction,
        account,
        chain: contract.chain,
        client: contract.client,
      })
      if (receipt) {
        toast.success('Distribution submitted successfully!', {
          style: toastStyle,
        })
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          shapes: ['circle', 'star'],
          colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
        })
        setTimeout(
          () =>
            router.push(
              `/projects/thank-you?quarter=${submissionQuarter}&year=${submissionYear}&type=member`
            ),
          3000
        )
      }
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error(formatTxError(error), {
        style: toastStyle,
        duration: 6000,
      })
    }
  }
  return (
    <section id="projects-container" className="overflow-hidden">
      <Head
        title="Projects"
        description="View active projects and allocate retroactive rewards to completed projects and their contributors based on impact and results.'"
      />
      <Container>
        <ContentLayout
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          branded={false}
        >
          <div className="mt-8 md:mt-12 flex flex-col gap-3 sm:gap-6">
            {/* Operator Panel — only renders for Executive Branch members */}
            <OperatorPanel
              proposals={proposals}
              currentProjects={currentProjects}
              pastProjects={pastProjects}
              onAfterChange={refreshRewards}
            />

            {/* Project System Intro */}
            <div className="bg-black/20 rounded-none sm:rounded-xl px-3 py-4 sm:p-5 border-y sm:border border-white/10">
              <div className="flex flex-col gap-4">
                <h2 className="font-GoodTimes text-white text-base sm:text-lg">
                  The Project System
                </h2>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Each quarter, contributors submit project proposals that go through a Senate
                  Vote for approval and a Member Vote for prioritization. Approved projects are
                  funded upfront, and once complete, submit a final report to earn retroactive
                  rewards based on community voting.
                </p>

                {/* Phase Timeline */}
                {(() => {
                  const phases = [
                    {
                      id: 'submit',
                      label: 'Submit',
                      subtitle: 'Proposal',
                      active: !isSenateVote && !isMemberVote,
                      tooltip:
                        "Anyone can submit a project proposal through the proposal portal. Each proposal lays out the problem, the solution, the team, and a budget capped at 1/5 of the quarterly rewards. Proposals can be edited at any time leading up to the Townhall.",
                      icon: (
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.232 5.232l3.536 3.536M9 13h3l8-8a2.828 2.828 0 00-4-4l-8 8v3zM5 19h14"
                          />
                        </svg>
                      ),
                    },
                    {
                      id: 'present',
                      label: 'Present',
                      subtitle: 'Townhall',
                      active: false,
                      tooltip:
                        "At the quarterly Townhall, every proposal gets a chance to pitch to the community. Each project has 10 minutes to walk through the problem they're solving, their proposed solution, the team, and the budget, followed by Q&A from the community.",
                      icon: (
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>
                      ),
                    },
                    {
                      id: 'senate',
                      label: 'Senate',
                      subtitle: 'Review',
                      active: isSenateVote,
                      tooltip:
                        "After the Townhall, the Senate votes to approve or reject each proposal under the rules in the Constitution. Each Senator has one vote. Approval requires a super-majority (more than 66.6%) of Senate votes in favor, with a quorum of at least 70% of all Senators participating. Only proposals that pass the Senate advance to the Member Vote.",
                      icon: (
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 3l8 4v5c0 4.418-3.582 8-8 9-4.418-1-8-4.582-8-9V7l8-4z"
                          />
                        </svg>
                      ),
                    },
                    {
                      id: 'member',
                      label: 'Member',
                      subtitle: 'Vote',
                      active: isMemberVote,
                      tooltip:
                        "Once the Senate has approved proposals, voting members distribute their voting power across the approved proposals as percentages. The top 50% by voting power are funded, capped so total project budgets stay under 3/4 of the quarterly budget. Contributors cannot vote on their own project.",
                      icon: (
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      ),
                    },
                    {
                      id: 'build',
                      label: 'Build',
                      subtitle: 'Execute',
                      active: false,
                      tooltip:
                        "Funded teams execute the project over the quarter, with budgets paid through the project's multisig. Leads give monthly written updates to the Senate and attend weekly Townhalls; Contributors post weekly progress in the #wdygdtw Discord channel. Missed updates and townhalls reduce retroactive rewards.",
                      icon: (
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      ),
                    },
                    {
                      id: 'retro',
                      label: 'Retroactive',
                      subtitle: 'Rewards',
                      active: isMemberVote && rewardVotingActive,
                      tooltip:
                        "At the end of the quarter, each completed project submits a Final Report with its contributor split. Citizens and Voting Members then allocate their voting power across the projects to determine retroactive ETH and vMOONEY rewards based on impact.",
                      icon: (
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      ),
                    },
                  ]

                  const activePhase = phases.find((p) => p.active) ?? phases[0]
                  return (
                    <div className="w-full pt-3 pb-1">
                      {/* Mobile: icon-only stepper with active-phase callout
                          below. Trying to cram 7 labelled columns onto a
                          ~360px screen makes every label illegible. */}
                      <div className="sm:hidden">
                        <div className="flex items-center justify-between">
                          {phases.map((phase, idx) => (
                            <div
                              key={phase.id}
                              className="flex items-center flex-1 min-w-0 last:flex-none"
                            >
                              <div
                                className={`relative w-9 h-9 shrink-0 rounded-full flex items-center justify-center border-2 transition-all ${
                                  phase.active
                                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 border-white/40 text-white shadow-[0_0_14px_rgba(99,102,241,0.55)]'
                                    : 'bg-white/5 border-white/15 text-gray-500'
                                }`}
                                aria-label={`${phase.label} ${phase.subtitle}${
                                  phase.active ? ' (current phase)' : ''
                                }`}
                              >
                                {phase.icon}
                                {phase.active && (
                                  <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                                  </span>
                                )}
                              </div>
                              {idx < phases.length - 1 && (
                                <div
                                  className={`h-0.5 flex-1 mx-1 rounded-full ${
                                    phase.active || phases[idx + 1].active
                                      ? 'bg-gradient-to-r from-blue-500/60 to-purple-600/60'
                                      : 'bg-white/10'
                                  }`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 rounded-lg bg-black/30 border border-emerald-400/20 p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-RobotoMono font-bold uppercase tracking-wider text-emerald-300 bg-emerald-400/15 border border-emerald-400/30 px-1.5 py-0.5 rounded">
                              Now
                            </span>
                            <span className="text-sm font-GoodTimes text-white">
                              {activePhase.label}
                              {activePhase.subtitle ? (
                                <span className="text-blue-300 font-normal">
                                  {' '}
                                  · {activePhase.subtitle}
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 leading-relaxed mt-2">
                            {activePhase.tooltip}
                          </p>
                        </div>
                      </div>

                      {/* Desktop: horizontal stepper with labels under each
                          circle. Plenty of room here for the full layout. */}
                      <div className="hidden sm:block">
                        <div className="flex items-start justify-between gap-2">
                          {phases.map((phase, idx) => (
                            <div
                              key={phase.id}
                              className="flex items-start flex-1 min-w-0"
                            >
                              <div className="flex flex-col items-center flex-1 min-w-0">
                                <div className="relative">
                                  <div
                                    className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                                      phase.active
                                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 border-white/40 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]'
                                        : 'bg-white/5 border-white/15 text-gray-500'
                                    }`}
                                  >
                                    {phase.icon}
                                  </div>
                                  {phase.active && (
                                    <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-col items-center w-full px-0.5">
                                  <div className="flex items-center justify-center gap-1 max-w-full">
                                    <span
                                      className={`text-xs font-RobotoMono font-semibold uppercase tracking-wider leading-tight text-center truncate ${
                                        phase.active ? 'text-white' : 'text-gray-500'
                                      }`}
                                    >
                                      {phase.label}
                                    </span>
                                    <Tooltip
                                      compact
                                      text={phase.tooltip}
                                      buttonClassName="!h-3.5 !w-3.5 !text-[8px] !pl-0 shrink-0"
                                    >
                                      ?
                                    </Tooltip>
                                  </div>
                                  <span
                                    className={`text-xs leading-tight text-center truncate max-w-full ${
                                      phase.active ? 'text-blue-300' : 'text-gray-600'
                                    }`}
                                  >
                                    {phase.subtitle}
                                  </span>
                                  {phase.active && (
                                    <span className="mt-1 px-1.5 py-0.5 rounded-sm text-[9px] font-RobotoMono font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                                      Now
                                    </span>
                                  )}
                                </div>
                              </div>
                              {idx < phases.length - 1 && (
                                <div
                                  className={`h-0.5 flex-shrink-0 flex-1 mt-[22px] mx-1 rounded-full ${
                                    phase.active || phases[idx + 1].active
                                      ? 'bg-gradient-to-r from-blue-500/60 to-purple-600/60'
                                      : 'bg-white/10'
                                  }`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                <Link
                  href="/project-system-docs"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors w-fit"
                >
                  Learn how the project system works
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Tabs - switch between Project Proposals, Active Projects, Past Projects */}
            {(() => {
              const pastProjectsWithReports = pastProjects?.filter(hasFinalReport) ?? []
              // `mobileLabel` is rendered <sm; the longer `label` shows from
              // sm up. Keeps the row from horizontally scrolling on phones.
              const tabs: {
                id: ProjectTab
                label: string
                mobileLabel: string
                count: number
              }[] = [
                {
                  id: 'proposals',
                  label: 'Project Proposals',
                  mobileLabel: 'Proposals',
                  count: proposals?.length ?? 0,
                },
                {
                  id: 'active',
                  label: 'Active Projects',
                  mobileLabel: 'Active',
                  count: currentProjects?.length ?? 0,
                },
                {
                  id: 'retroactive',
                  label: 'Retroactive Rewards',
                  mobileLabel: 'Retro',
                  count: eligibleProjects?.length ?? 0,
                },
                {
                  id: 'past',
                  label: 'Past Projects',
                  mobileLabel: 'Past',
                  count: pastProjectsWithReports.length,
                },
              ]
              return (
                <div
                  id="projects-tabs"
                  role="tablist"
                  aria-label="Project sections"
                  className="-mb-3 sm:-mb-4 px-1 sm:px-0 flex items-end gap-1 border-b border-white/10 overflow-x-auto scrollbar-hide"
                >
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(tab.id)}
                        className={`group relative px-3 sm:px-5 py-2.5 sm:py-3 -mb-px text-xs sm:text-sm font-RobotoMono uppercase tracking-wider whitespace-nowrap transition-colors rounded-t-lg border border-b-0 ${
                          isActive
                            ? 'bg-black/40 border-white/15 text-white'
                            : 'bg-transparent border-transparent text-gray-500 hover:text-gray-200'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 sm:gap-2">
                          <span className="sm:hidden">{tab.mobileLabel}</span>
                          <span className="hidden sm:inline">{tab.label}</span>
                          <span
                            className={`inline-flex items-center justify-center min-w-[20px] px-1.5 h-5 rounded-full text-[10px] font-semibold ${
                              isActive
                                ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                                : 'bg-white/5 text-gray-500 border border-white/10 group-hover:bg-white/10 group-hover:text-gray-300'
                            }`}
                          >
                            {tab.count}
                          </span>
                        </span>
                        {isActive && (
                          <span className="pointer-events-none absolute left-2 right-2 -bottom-px h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {activeTab === 'proposals' && (
              <div
                id="proposals-container"
                className="bg-black/20 rounded-none sm:rounded-b-xl px-1 py-2 sm:p-6 border-y sm:border sm:border-t-0 border-white/10"
              >
                {/* Upcoming-quarter rewards summary. Q2 2026 proposals are
                    funded in USDC from `USD_BUDGET`; the retroactive ETH pool
                    lives in the Retroactive Rewards tab. */}
                <div className="mb-4 sm:mb-6 px-1 sm:px-0">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-4">
                    <h1 className="font-GoodTimes text-white/80 text-base sm:text-lg">{`Q${currentQuarter}: ${currentYear} Rewards`}</h1>
                    {/* Permission-check warning is suppressed for everyday
                        users because they would never see the "Close voting"
                        button anyway. The error is still logged to the
                        console for the Proposals contract owner / EB. */}
                    {isSenateVote && isProposalsContractOwner && (
                      <button
                        onClick={tallyVotes}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl border-0 text-sm flex items-center justify-center gap-2 w-fit"
                      >
                        Close voting.
                      </button>
                    )}
                    <button
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl border-0 text-sm flex items-center justify-center gap-2 w-fit"
                      onClick={() => router.push('/proposals')}
                    >
                      <Image
                        src={'/assets/plus-icon.png'}
                        width={16}
                        height={16}
                        alt="Create Project"
                      />
                      <span className="leading-none">Create Project</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-4">
                    <div className="bg-black/20 rounded-lg p-2 sm:p-3 border border-white/10">
                      <RewardAsset
                        name="USDC"
                        value={`$${USD_BUDGET.toLocaleString()}`}
                        usdValue={USD_BUDGET.toFixed(2)}
                      />
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 sm:p-3 border border-white/10">
                      <RewardAsset
                        name="MOONEY"
                        value={Number(
                          proposalsMooneyBudget.toPrecision(3)
                        ).toLocaleString()}
                        usdValue={proposalsMooneyBudgetUSD.toFixed(2)}
                        approximateUSD
                      />
                    </div>
                  </div>
                </div>

                <h2 className="font-GoodTimes text-white/80 text-base sm:text-xl mb-2 sm:mb-6 px-1 sm:px-0">
                  {isSenateVote ? (
                    <>
                      Project Proposals
                      <span className="ml-2 text-sm font-normal text-orange-400">(Senate Vote)</span>
                    </>
                  ) : isMemberVote ? (
                    <Tooltip text="Distribute voting power among the proposals by percentage." wrap>
                      Project Proposals
                      <span className="ml-2 text-sm font-normal text-emerald-400">(Member Vote)</span>
                    </Tooltip>
                  ) : (
                    <>
                      Pending Proposals
                      <span className="ml-2 text-sm font-normal text-blue-400">({proposals?.length ?? 0})</span>
                    </>
                  )}
                </h2>
                {isMemberVote && !isSenateVote && (
                  <p className="mb-4">
                    Member Vote: Distribute 100% of your voting power between eligible projects that have passed the Senate vote. Give a higher percent to the projects with a bigger impact, and click Submit Distribution.
                  </p>
                )}
                {!isSenateVote && !isMemberVote && (
                  <p className="mb-4 text-gray-400 text-sm">
                    These proposals have been submitted and are awaiting the next voting cycle.
                  </p>
                )}
                <div className="flex flex-col gap-1.5 sm:gap-6">
                  {proposals && proposals.length > 0 ? (
                    proposals
                      .filter((project: any) => {
                        if (isSenateVote) {
                          return !project.tempCheckApproved && !project.tempCheckFailed
                        }

                        if (isMemberVote) {
                          return project.tempCheckApproved && !project.tempCheckFailed
                        }

                        return !project.tempCheckFailed
                      })
                      .map((project: any, i) => (
                        <div
                          key={`project-card-${i}`}
                          className="bg-black/20 rounded-lg sm:rounded-xl border border-white/10 overflow-hidden mx-0"
                        >
                          <ProjectCard
                            key={`project-card-${i}`}
                            project={project}
                            projectContract={projectContract}
                            hatsContract={hatsContract}
                            distribute={approvalVotingActive && (isSenateVote || isMemberVote)}
                            distribution={userHasVotingPower && (isSenateVote || isMemberVote) ? proposalDistribution : undefined}
                            handleDistributionChange={
                              userHasVotingPower && (isSenateVote || isMemberVote) ? handleProposalDistributionChange : undefined
                            }
                            userHasVotingPower={userHasVotingPower}
                            isVotingPeriod={approvalVotingActive && (isSenateVote || isMemberVote)}
                            active={false}
                            isSenateVote={isSenateVote}
                          />
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>No project proposals yet for this cycle.</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Click “Create Project” above to submit one.
                      </p>
                    </div>
                  )}
                  {approvalVotingActive && isMemberVote && proposals && proposals.length > 0 && (() => {
                    const proposalAllocatedPct = _.sum(
                      Object.entries(proposalDistribution)
                        .filter(([id]) => validProposalIds.has(id))
                        .map(([, v]) => v)
                    )
                    return (
                      <div className="mt-6 w-full bg-gradient-to-br from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                          <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className="bg-slate-800/40 border border-white/10 rounded-lg px-3 py-2 sm:px-4 sm:py-3 min-w-0">
                              <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-RobotoMono truncate">
                                Allocated
                              </div>
                              <div
                                className={`mt-0.5 sm:mt-1 font-GoodTimes text-lg sm:text-xl tracking-wider ${
                                  proposalAllocatedPct === 100
                                    ? 'text-green-400'
                                    : 'text-white'
                                }`}
                              >
                                {proposalAllocatedPct}%
                              </div>
                            </div>
                            <div className="bg-slate-800/40 border border-white/10 rounded-lg px-3 py-2 sm:px-4 sm:py-3 min-w-0">
                              <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-RobotoMono truncate">
                                Voting Power
                              </div>
                              <div className="mt-0.5 sm:mt-1 font-GoodTimes text-lg sm:text-xl tracking-wider text-white truncate">
                                {Math.round(userVotingPower ?? 0)}
                              </div>
                            </div>
                          </div>
                          <div className="w-full sm:w-auto sm:shrink-0">
                            {userHasVotingPower ? (
                              proposalSubmitting ? (
                                <button
                                  type="button"
                                  disabled
                                  className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-RobotoMono rounded-lg shadow-lg border-0 text-sm min-w-[180px] opacity-80 cursor-wait"
                                >
                                  <span className="w-full flex justify-center items-center gap-2">
                                    <LoadingSpinner width="w-5" height="h-5" />
                                    <span className="text-sm font-medium leading-snug">
                                      Check your wallet…
                                    </span>
                                  </span>
                                </button>
                              ) : (
                                <PrivyWeb3Button
                                  action={() => handleProposalSubmit(proposalContract)}
                                  requiredChain={chain}
                                  className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl border-0 text-sm min-w-[180px]"
                                  label={proposalEdit ? 'Edit Distribution' : 'Submit Distribution'}
                                  loadingLabel="Check your wallet…"
                                />
                              )
                            ) : (
                              <PrivyWeb3Button
                                v5
                                requiredChain={DEFAULT_CHAIN_V5}
                                label="Get Voting Power"
                                action={() => router.push('/lock')}
                                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl border-0 text-sm min-w-[180px]"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'active' && (
            <div
              id="projects-container"
              className="bg-black/20 rounded-none sm:rounded-b-xl px-1 py-2 sm:p-6 border-y sm:border sm:border-t-0 border-white/10"
            >
              <h1 className="font-GoodTimes text-white/80 text-base sm:text-xl mb-2 sm:mb-6 px-1 sm:px-0">Active Projects</h1>

              <div className="flex flex-col gap-1.5 sm:gap-6">
                {ineligibleProjects && ineligibleProjects.length > 0 ? (
                  ineligibleProjects.map((project: any, i) => (
                    <ProjectCard
                      key={`project-card-${i}`}
                      project={project}
                      projectContract={projectContract}
                      hatsContract={hatsContract}
                      distribute={false}
                      userHasVotingPower={userHasVotingPower}
                      isVotingPeriod={rewardVotingActive}
                      active={true}
                      isSenateVote={isSenateVote}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>No active projects in flight.</p>
                    {eligibleProjects && eligibleProjects.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Projects eligible for retroactive rewards live in the
                        <span className="text-gray-300"> Retroactive Rewards </span>
                        tab.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}
            {activeTab === 'retroactive' && (
              <div
                id="retroactive-rewards-container"
                className="bg-black/20 rounded-none sm:rounded-b-xl px-1 py-2 sm:p-6 border-y sm:border sm:border-t-0 border-white/10"
              >
                <div className="px-1 sm:px-0 mb-3 sm:mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <h1 className="font-GoodTimes text-white/80 text-base sm:text-xl">
                      Retroactive Rewards
                      <span className="ml-2 text-sm font-normal text-emerald-400">
                        Q{quarter} {year}
                      </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-prose">
                      Projects eligible for this cycle’s retroactive rewards. The pool
                      is split proportionally based on Citizen and Voting Member
                      allocations.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-blue-500/10 text-blue-200 border border-blue-400/30 px-3 py-1.5 rounded-full font-RobotoMono">
                      Pool: {retroPrimaryBudget.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{' '}
                      {retroPrimaryAssetName}
                      {isEthPayoutCycle &&
                        retroPrimaryBudgetUsdValue > 0 &&
                        ` (~$${retroPrimaryBudgetUsdValue.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })})`}
                    </span>
                    <span className="bg-purple-500/10 text-purple-200 border border-purple-400/30 px-3 py-1.5 rounded-full font-RobotoMono">
                      +{' '}
                      {Number(mooneyBudget.toPrecision(3)).toLocaleString()} MOONEY
                    </span>
                  </div>
                </div>

                {eligibleProjects && eligibleProjects.length > 0 ? (
                  <div className="flex flex-col gap-1.5 sm:gap-6">
                    {rewardVotingActive && (
                      <p className="text-xs sm:text-sm text-emerald-300/90 px-1 sm:px-0">
                        Distribute 100% of your voting power across the eligible
                        projects below — give a higher percentage to higher-impact
                        projects, then click <em>Submit Distribution</em>.
                      </p>
                    )}

                    {eligibleProjects.map((project, i) => {
                      const pct = projectIdToEstimatedPercentage[project.id]
                      const hasPct = typeof pct === 'number' && pct > 0
                      const primaryShare = hasPct
                        ? (pct / 100) * retroPrimaryBudget
                        : null
                      const mooneyShare = hasPct
                        ? (pct / 100) * mooneyBudget
                        : null
                      return (
                        <div key={`retro-card-${project.id}`} className="flex flex-col gap-1">
                          <ProjectCard
                            project={project}
                            projectContract={projectContract}
                            hatsContract={hatsContract}
                            distribute={
                              rewardVotingActive &&
                              (project.finalReportLink || project.finalReportIPFS)
                            }
                            distribution={
                              userHasVotingPower ? distribution : undefined
                            }
                            handleDistributionChange={
                              userHasVotingPower
                                ? handleDistributionChange
                                : undefined
                            }
                            userHasVotingPower={userHasVotingPower}
                            isVotingPeriod={rewardVotingActive}
                            active={true}
                            isSenateVote={isSenateVote}
                            hideStatusBadge={true}
                            // Wrap the whole card in a project-page link only
                            // when the user *isn't* actively allocating. While
                            // distribution is open and the user has voting
                            // power, stray clicks near (or bubbling out of)
                            // the NumberStepper would otherwise navigate
                            // them away mid-vote. The project name itself
                            // remains a link via ProjectCardContent so
                            // intentional navigation still works.
                            linkToProjectPage={
                              !(rewardVotingActive && userHasVotingPower)
                            }
                          />
                          {/* Per-project share preview — only render when we
                              have a real tally; otherwise the row is a no-op
                              and the project card alone is plenty. */}
                          {hasPct && (
                            <div className="flex flex-wrap items-center justify-end gap-3 px-2 sm:px-3 pb-2 text-[11px] font-RobotoMono">
                              <span className="text-gray-500">
                                Estimated payout @ {pct.toFixed(1)}% of pool:
                              </span>
                              <span className="text-white">
                                {primaryShare!.toLocaleString(undefined, {
                                  maximumFractionDigits: isEthPayoutCycle ? 4 : 0,
                                })}{' '}
                                {retroPrimaryAssetName}
                              </span>
                              <span className="text-purple-200">
                                {Number(
                                  mooneyShare!.toPrecision(3)
                                ).toLocaleString()}{' '}
                                MOONEY
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {!readyToRunVoting && (
                      <p className="text-[11px] text-gray-500 mt-2 px-1 sm:px-0">
                        Per-project amounts populate once Citizen and Voting Member
                        distributions are submitted and tallied. Until then this lists
                        the eligible cohort and the total pool.
                      </p>
                    )}

                    {rewardVotingActive && (() => {
                      const retroAllocatedPct = _.sum(
                        Object.entries(distribution)
                          .filter(([id]) => validEligibleIds.has(id))
                          .map(([, v]) => v)
                      )
                      return (
                      <div className="mt-4 sm:mt-6 w-full bg-gradient-to-br from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                          {userHasVotingPower ? (
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="bg-slate-800/40 border border-white/10 rounded-lg px-3 py-2 sm:px-4 sm:py-3 min-w-0">
                                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-RobotoMono truncate">
                                  Allocated
                                </div>
                                <div
                                  className={`mt-0.5 sm:mt-1 font-GoodTimes text-lg sm:text-xl tracking-wider ${
                                    retroAllocatedPct === 100
                                      ? 'text-green-400'
                                      : 'text-white'
                                  }`}
                                >
                                  {retroAllocatedPct}%
                                </div>
                              </div>
                              <div className="bg-slate-800/40 border border-white/10 rounded-lg px-3 py-2 sm:px-4 sm:py-3 min-w-0">
                                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-RobotoMono truncate">
                                  Voting Power
                                </div>
                                <div className="mt-0.5 sm:mt-1 font-GoodTimes text-lg sm:text-xl tracking-wider text-white truncate">
                                  {Math.round(userVotingPower ?? 0)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="flex-1 min-w-0 text-xs sm:text-sm text-gray-300 leading-relaxed">
                              You need vMOONEY voting power to weigh in on
                              retroactive rewards. Lock MOONEY to participate.
                            </p>
                          )}
                          <div className="w-full sm:w-auto sm:shrink-0">
                            {userHasVotingPower ? (
                              <PrivyWeb3Button
                                action={() => handleSubmit(distributionTableContract)}
                                requiredChain={chain}
                                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl border-0 text-sm min-w-[180px]"
                                label={edit ? 'Edit Distribution' : 'Submit Distribution'}
                                loadingLabel="Check your wallet…"
                              />
                            ) : (
                              <PrivyWeb3Button
                                v5
                                requiredChain={DEFAULT_CHAIN_V5}
                                label="Get Voting Power"
                                action={() => router.push('/lock')}
                                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl border-0 text-sm min-w-[180px]"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>No projects are eligible for retroactive rewards yet.</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Operators can mark a project eligible from the panel above.
                    </p>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'past' && (
            <div className="bg-black/20 rounded-none sm:rounded-b-xl border-y sm:border sm:border-t-0 border-white/10">
              <PastProjects projects={pastProjects} />
            </div>
            )}
          </div>
        </ContentLayout>
      </Container>

      {equalWarningOpen && (
        <Modal
          id="equal-weight-warning-modal"
          setEnabled={(open) => {
            if (!open) setEqualWarningOpen(false)
          }}
          size="md"
        >
          <div className="flex flex-col gap-5 text-sm p-1 sm:p-2">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg sm:text-xl font-GoodTimes text-white tracking-wider">
                Hey! A quick gut-check
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Try to really think about your allocation for proposals. We
                noticed you gave the same weight to each project — this is
                the same as not voting at all. Try to really consider where
                MoonDAO&apos;s funds are best spent!
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEqualWarningOpen(false)}
                className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-RobotoMono transition-colors"
              >
                Adjust My Vote
              </button>
              <button
                type="button"
                onClick={async () => {
                  setEqualWarningOpen(false)
                  setProposalSubmitting(true)
                  try {
                    await handleProposalSubmit(proposalContract, {
                      bypassEqualCheck: true,
                    })
                  } finally {
                    setProposalSubmitting(false)
                  }
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-RobotoMono shadow"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
