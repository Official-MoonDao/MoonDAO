import confetti from 'canvas-confetti'
import DistributionTableABI from 'const/abis/DistributionTable.json'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import ProposalsABI from 'const/abis/Proposals.json'
import {
  DEFAULT_CHAIN_V5,
  DISTRIBUTION_TABLE_ADDRESSES,
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  PROPOSALS_ADDRESSES,
  ARBITRUM_ASSETS_URL,
  POLYGON_ASSETS_URL,
  BASE_ASSETS_URL,
  USD_BUDGET,
  IS_SENATE_VOTE,
  IS_MEMBER_VOTE,
} from 'const/config'
import useStakedEth from 'lib/utils/hooks/useStakedEth'
import _ from 'lodash'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, readContract, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useCitizens } from '@/lib/citizen/useCitizen'
import { useAssets } from '@/lib/dashboard/hooks'
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
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import StandardButtonRight from '@/components/layout/StandardButtonRight'
import Tooltip from '@/components/layout/Tooltip'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import PastProjects from '@/components/project/PastProjects'
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

  const [rewardVotingActive, setRewardVotingActive] = useState(false)
  const [approvalVotingActive, setApprovalVotingActive] = useState(false)
  const { quarter, year } = getRelativeQuarter(rewardVotingActive ? -1 : 0)
  const { quarter: currentQuarter, year: currentYear } = getRelativeQuarter(0)
  const { quarter: submissionQuarter, year: submissionYear } = getSubmissionQuarter()

  const [edit, setEdit] = useState(false)
  const [distribution, setDistribution] = useState<{ [key: string]: number }>({})
  const [originalDistribution, setOriginalDistribution] = useState<{ [key: string]: number }>({})

  type ProjectTab = 'proposals' | 'active' | 'past'
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

  // Proposals contract owner (only they can close voting)
  const [proposalsContractOwner, setProposalsContractOwner] = useState<string | null>(null)
  const [proposalsOwnerStatus, setProposalsOwnerStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [proposalsOwnerRetryCount, setProposalsOwnerRetryCount] = useState(0)

  //Check if its the approval cycle
  useEffect(() => {
    setApprovalVotingActive(isApprovalActive(new Date()))
    const interval = setInterval(() => {
      setApprovalVotingActive(isApprovalActive(new Date()))
    }, 30000)
    return () => clearInterval(interval)
  })

  //Check if its the rewards cycle
  useEffect(() => {
    setRewardVotingActive(isRewardsCycle(new Date()))
    const interval = setInterval(() => {
      setRewardVotingActive(isRewardsCycle(new Date()))
    }, 30000)
    return () => clearInterval(interval)
  })

  // Check if the user already has a distribution for the current quarter
  useEffect(() => {
    if (distributions && userAddress) {
      for (const d of distributions) {
        if (
          d.year === year &&
          d.quarter === quarter &&
          d.address.toLowerCase() === userAddress.toLowerCase()
        ) {
          setDistribution(d.distribution)
          setOriginalDistribution(d.distribution)
          setEdit(true)
          break
        }
      }
    }
  }, [userAddress, distributions, quarter, year])

  // Check if the user already has a proposal allocation for the current quarter
  useEffect(() => {
    if (proposalAllocations && userAddress) {
      for (const d of proposalAllocations) {
        if (
          d.year === year &&
          d.quarter === quarter &&
          d.address.toLowerCase() === userAddress.toLowerCase()
        ) {
          setProposalDistribution(d.distribution)
          setOriginalProposalDistribution(d.distribution)
          setProposalEdit(true)
          break
        }
      }
    }
  }, [userAddress, proposalAllocations, quarter, year])

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
    setProposalsOwnerStatus('loading')

    readContract({
      contract: proposalContract,
      method: 'owner' as string,
      params: [],
    })
      .then((result: unknown) => {
        if (isCancelled) return
        const owner = typeof result === 'string' ? result : Array.isArray(result) ? result[0] : null
        setProposalsContractOwner(owner != null ? String(owner).toLowerCase() : null)
        setProposalsOwnerStatus('success')
      })
      .catch(() => {
        if (isCancelled) return
        setProposalsContractOwner(null)
        setProposalsOwnerStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [proposalContract, proposalsOwnerRetryCount])

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

  const usdBudget = USD_BUDGET
  const [mooneyBudgetUSD, setMooneyBudgetUSD] = useState(0)

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
    USD_BUDGET,
    mooneyBudget
  )

  useEffect(() => {
    let isCancelled = false

    async function getMooneyBudgetUSD() {
      try {
        // Skip if mooneyBudget is 0 or very small to avoid unnecessary calls
        if (!mooneyBudget || mooneyBudget < 0.01) {
          setMooneyBudgetUSD(0)
          return
        }

        const response = await fetch('/api/mooney/price')
        if (!response.ok) {
          throw new Error('Failed to fetch MOONEY price')
        }

        const data = await response.json()
        const mooneyPriceUSD = data.result?.price || 0

        if (!isCancelled && mooneyPriceUSD > 0) {
          const usd = mooneyBudget * mooneyPriceUSD
          setMooneyBudgetUSD(usd)
        }
      } catch (error) {
        console.error('Error fetching Mooney budget USD:', error)
        if (!isCancelled) {
          // Set a fallback value or keep the previous value
          setMooneyBudgetUSD(0)
        }
      }
    }

    if (mooneyBudget) {
      getMooneyBudgetUSD()
    }

    return () => {
      isCancelled = true
    }
  }, [mooneyBudget])

  const handleSubmit = async (contract: any) => {
    const totalPercentage = Object.values(distribution).reduce((sum, value) => sum + value, 0)
    if (totalPercentage !== 100) {
      toast.error('Total distribution must equal 100%.', {
        style: toastStyle,
      })
      return
    }
    if (edit && _.isEqual(distribution, originalDistribution)) {
      toast.error('No changes detected. Please modify your distribution before resubmitting.', {
        style: toastStyle,
      })
      return
    }
    try {
      if (!account) throw new Error('No account found')
      let receipt
      if (edit) {
        const transaction = prepareContractCall({
          contract: contract,
          method: 'updateTableCol' as string,
          params: [quarter, year, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      } else {
        const transaction = prepareContractCall({
          contract: contract,
          method: 'insertIntoTable' as string,
          params: [quarter, year, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }
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
        setTimeout(() => router.push(`/projects/thank-you?quarter=${quarter}&year=${year}`), 3000)
      }
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error('Error submitting distribution. Please try again.', {
        style: toastStyle,
      })
    }
  }

  const handleProposalSubmit = async (contract: any) => {
    const totalPercentage = Object.values(proposalDistribution).reduce((sum, value) => sum + value, 0)
    if (totalPercentage !== 100) {
      toast.error('Total distribution must equal 100%.', {
        style: toastStyle,
      })
      return
    }
    if (proposalEdit && _.isEqual(proposalDistribution, originalProposalDistribution)) {
      toast.error('No changes detected. Please modify your distribution before resubmitting.', {
        style: toastStyle,
      })
      return
    }
    // Exclude projects where the user is the author (they cannot vote on their own proposal)
    const userAddr = userAddress?.toLowerCase()
    const distributionToSubmit: Record<string, number> = {}
    for (const [projectId, value] of Object.entries(proposalDistribution)) {
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
      let receipt
      if (proposalEdit) {
        const transaction = prepareContractCall({
          contract: contract,
          method: 'updateTableCol' as string,
          params: [quarter, year, JSON.stringify(normalizedDistribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      } else {
        const transaction = prepareContractCall({
          contract: contract,
          method: 'insertIntoTable' as string,
          params: [quarter, year, JSON.stringify(normalizedDistribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }
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
        setTimeout(() => router.push(`/projects/thank-you?quarter=${quarter}&year=${year}`), 3000)
      }
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error('Error submitting distribution. Please try again.', {
        style: toastStyle,
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
                      active: !IS_SENATE_VOTE && !IS_MEMBER_VOTE,
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
                      id: 'senate',
                      label: 'Senate',
                      subtitle: 'Review',
                      active: IS_SENATE_VOTE,
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
                      active: IS_MEMBER_VOTE,
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
                      active: IS_MEMBER_VOTE && rewardVotingActive,
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

                  return (
                    <div className="w-full pt-3 pb-1">
                      <div className="flex items-start justify-between gap-1 sm:gap-2">
                        {phases.map((phase, idx) => (
                          <div
                            key={phase.id}
                            className="flex items-start flex-1 min-w-0"
                          >
                            <div className="flex flex-col items-center flex-1 min-w-0">
                              <div className="relative">
                                <div
                                  className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-2 transition-all ${
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
                                <span
                                  className={`text-[10px] sm:text-xs font-RobotoMono font-semibold uppercase tracking-wider leading-tight text-center truncate max-w-full ${
                                    phase.active ? 'text-white' : 'text-gray-500'
                                  }`}
                                >
                                  {phase.label}
                                </span>
                                <span
                                  className={`hidden sm:inline text-[10px] sm:text-xs leading-tight text-center truncate max-w-full ${
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
                                className={`h-0.5 flex-shrink-0 w-3 sm:w-auto sm:flex-1 mt-[16px] sm:mt-[22px] mx-0.5 sm:mx-1 rounded-full ${
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

            {/* Condensed Top Section - Rewards + Create Button */}
            <div className="bg-black/20 rounded-none sm:rounded-xl px-1 py-2 sm:p-4 border-y sm:border border-white/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-4 px-1 sm:px-0">
                <h1 className="font-GoodTimes text-white/80 text-base sm:text-lg">{`Q${currentQuarter}: ${currentYear} Rewards`}</h1>
                {IS_SENATE_VOTE && proposalsOwnerStatus === 'error' && (
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 text-sm">Unable to check permissions</span>
                    <button
                      onClick={() => setProposalsOwnerRetryCount((c) => c + 1)}
                      className="px-4 py-2 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 text-white font-RobotoMono rounded-lg transition-all duration-200 text-sm"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {IS_SENATE_VOTE && isProposalsContractOwner && (
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
                {/*FIXME run on cron */}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-4 px-1 sm:px-0">
                <div className="bg-black/20 rounded-lg p-2 sm:p-3 border border-white/10">
                  <RewardAsset
                    name="USDC"
                    value={`$${USD_BUDGET.toLocaleString()}`}
                    usdValue={usdBudget.toFixed(2)}
                  />
                </div>
                <div className="bg-black/20 rounded-lg p-2 sm:p-3 border border-white/10">
                  <RewardAsset
                    name="MOONEY"
                    value={Number(mooneyBudget.toPrecision(3)).toLocaleString()}
                    usdValue={mooneyBudgetUSD.toFixed(2)}
                    approximateUSD
                  />
                </div>
              </div>
            </div>

            {/* Tabs - switch between Project Proposals, Active Projects, Past Projects */}
            {(() => {
              const tabs: { id: ProjectTab; label: string; count: number }[] = [
                { id: 'proposals', label: 'Project Proposals', count: proposals?.length ?? 0 },
                { id: 'active', label: 'Active Projects', count: currentProjects?.length ?? 0 },
                { id: 'past', label: 'Past Projects', count: pastProjects?.length ?? 0 },
              ]
              return (
                <div
                  id="projects-tabs"
                  role="tablist"
                  aria-label="Project sections"
                  className="-mb-3 sm:-mb-4 px-1 sm:px-0 flex items-end gap-1 border-b border-white/10 overflow-x-auto"
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
                        <span className="flex items-center gap-2">
                          <span>{tab.label}</span>
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

            {activeTab === 'proposals' && proposals && proposals.length > 0 && (
              <div
                id="proposals-container"
                className="bg-black/20 rounded-none sm:rounded-b-xl px-1 py-2 sm:p-6 border-y sm:border sm:border-t-0 border-white/10"
              >
                <h1 className="font-GoodTimes text-white/80 text-base sm:text-xl mb-2 sm:mb-6 px-1 sm:px-0">
                  {IS_SENATE_VOTE ? (
                    <>
                      Project Proposals
                      <span className="ml-2 text-sm font-normal text-orange-400">(Senate Vote)</span>
                    </>
                  ) : IS_MEMBER_VOTE ? (
                    <Tooltip text="Distribute voting power among the proposals by percentage." wrap>
                      Project Proposals
                      <span className="ml-2 text-sm font-normal text-emerald-400">(Member Vote)</span>
                    </Tooltip>
                  ) : (
                    <>
                      Pending Proposals
                      <span className="ml-2 text-sm font-normal text-blue-400">({proposals.length})</span>
                    </>
                  )}
                </h1>
                {IS_MEMBER_VOTE && !IS_SENATE_VOTE && (
                  <p className="mb-4">
                    Member Vote: Distribute 100% of your voting power between eligible projects that have passed the Senate vote. Give a higher percent to the projects with a bigger impact, and click Submit Distribution.
                  </p>
                )}
                {!IS_SENATE_VOTE && !IS_MEMBER_VOTE && (
                  <p className="mb-4 text-gray-400 text-sm">
                    These proposals have been submitted and are awaiting the next voting cycle.
                  </p>
                )}
                <div className="flex flex-col gap-1.5 sm:gap-6">
                  {proposals
                      .filter((project: any) => {
                        if (IS_SENATE_VOTE) {
                          return !project.tempCheckApproved && !project.tempCheckFailed
                        }

                        if (IS_MEMBER_VOTE) {
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
                            distribute={approvalVotingActive && (IS_SENATE_VOTE || IS_MEMBER_VOTE)}
                            distribution={userHasVotingPower && (IS_SENATE_VOTE || IS_MEMBER_VOTE) ? proposalDistribution : undefined}
                            handleDistributionChange={
                              userHasVotingPower && (IS_SENATE_VOTE || IS_MEMBER_VOTE) ? handleProposalDistributionChange : undefined
                            }
                            userHasVotingPower={userHasVotingPower}
                            isVotingPeriod={approvalVotingActive && (IS_SENATE_VOTE || IS_MEMBER_VOTE)}
                            active={false}
                          />
                        </div>
                      ))
                  }
                  {approvalVotingActive && IS_MEMBER_VOTE && proposals && proposals.length > 0 && (
                    <div className="mt-6 w-full flex flex-col items-end gap-2">
                      <div className="text-white/80 font-RobotoMono text-sm">
                        Allocated: {_.sum(Object.values(proposalDistribution))}% &nbsp;&nbsp;Voting Power:{' '}
                        {Math.round(userVotingPower ?? 0)}
                      </div>
                      {userHasVotingPower ? (
                        <span className="flex flex-col md:flex-row md:items-center gap-2">
                          <PrivyWeb3Button
                            action={() => handleProposalSubmit(proposalContract)}
                            requiredChain={chain}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                            label={proposalEdit ? 'Edit Distribution' : 'Submit Distribution'}
                          />
                        </span>
                      ) : (
                        <span>
                          <PrivyWeb3Button
                            v5
                            requiredChain={DEFAULT_CHAIN_V5}
                            label="Get Voting Power"
                            action={() => router.push('/lock')}
                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                          />
                        </span>
                      )}
                    </div>
                  )}
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
                {currentProjects && currentProjects.length > 0 ? (
                  currentProjects
                    .filter((project: any, i) => {
                      return project.eligible
                    })
                    .map((project: any, i) => (
                      <ProjectCard
                        key={`project-card-${i}`}
                        project={project}
                        projectContract={projectContract}
                        hatsContract={hatsContract}
                        distribute={
                          rewardVotingActive &&
                          project.eligible &&
                          (project!.finalReportLink || project!.finalReportIPFS)
                        }
                        distribution={userHasVotingPower ? distribution : undefined}
                        handleDistributionChange={
                          userHasVotingPower ? handleDistributionChange : undefined
                        }
                        userHasVotingPower={userHasVotingPower}
                        isVotingPeriod={rewardVotingActive}
                        active={true}
                      />
                    ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>There are no active projects.</p>
                  </div>
                )}

                {rewardVotingActive && eligibleProjects && eligibleProjects.length > 0 && (
                  <div className="mt-6 w-full flex justify-end">
                    {userHasVotingPower ? (
                      <span className="flex flex-col md:flex-row md:items-center gap-2">
                        <PrivyWeb3Button
                          action={() => handleSubmit(distributionTableContract)}
                          requiredChain={chain}
                          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                          label={edit ? 'Edit Distribution' : 'Submit Distribution'}
                        />
                      </span>
                    ) : (
                      <span>
                        <PrivyWeb3Button
                          v5
                          requiredChain={DEFAULT_CHAIN_V5}
                          label="Get Voting Power"
                          action={() => router.push('/lock')}
                          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                        />
                      </span>
                    )}
                  </div>
                )}

                {currentProjects &&
                  currentProjects.length > 0 &&
                  currentProjects
                    .filter((project: any, i) => {
                      return !project.eligible
                    })
                    .map((project: any, i) => (
                      <ProjectCard
                        key={`project-card-${i}`}
                        project={project}
                        projectContract={projectContract}
                        hatsContract={hatsContract}
                        distribute={project.eligible}
                        distribution={userHasVotingPower ? distribution : undefined}
                        handleDistributionChange={
                          userHasVotingPower ? handleDistributionChange : undefined
                        }
                        userHasVotingPower={userHasVotingPower}
                        isVotingPeriod={rewardVotingActive}
                      />
                    ))}
              </div>
            </div>
            )}
            {activeTab === 'past' && (
            <div className="bg-black/20 rounded-none sm:rounded-b-xl border-y sm:border sm:border-t-0 border-white/10 overflow-hidden">
              <PastProjects projects={pastProjects} />
            </div>
            )}
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
