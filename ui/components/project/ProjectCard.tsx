//This component dipslays a project card using project data directly from tableland
import { usePrivy } from '@privy-io/react-auth'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import Link from 'next/link'
import React, { useContext, memo, useState, useMemo, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import { PROJECT_ACTIVE, PROJECT_PENDING } from '@/lib/nance/types'
import useProposalJSON from '@/lib/nance/useProposalJSON'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { normalizeJsonString } from '@/lib/utils/rewards'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import NumberStepper from '../layout/NumberStepper'
import StandardButton from '../layout/StandardButton'

type ProjectCardProps = {
  project: Project | undefined
  projectContract: any
  hatsContract: any
  distribute?: boolean
  userContributed?: boolean
  distribution?: Record<string, number>
  handleDistributionChange?: (projectId: string, value: number) => void
  userHasVotingPower?: any
  isVotingPeriod?: boolean
  active?: boolean
}

const ProjectCardContent = memo(
  ({
    project,
    distribution,
    handleDistributionChange,
    distribute,
    userContributed,
    userHasVotingPower,
    isMembershipDataLoading,
    isVotingPeriod,
    active,
  }: any) => {
    const proposalJSON = useProposalJSON(project)
    const account = useActiveAccount()
    const description =
      project && project.MDP < 13 ? project.description : project?.description || ''

    // Set character limits that better match the new card height
    const [characterLimit, setCharacterLimit] = useState(380)

    useEffect(() => {
      const handleResize = () => {
        if (typeof window !== 'undefined') {
          // Adjust limits for the new 280px height with better spacing
          setCharacterLimit(window.innerWidth >= 1024 ? 420 : 380)
        }
      }

      if (typeof window !== 'undefined') {
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }
    }, [])

    return (
      <div
        id="card-container"
        className="p-6 pb-6 flex flex-col gap-3 relative w-full h-[200px] max-h-[200px] overflow-hidden bg-gradient-to-br from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg transition-all duration-300 hover:bg-gradient-to-br hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl hover:scale-[1.02]"
      >
        <div className="flex justify-between items-start">
          <div className="w-full flex flex-col gap-3">
            <Link href={`/project/${project?.id}`} passHref>
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-white leading-tight">{project?.name || ''}</h4>
                <span
                  className={`mr-4 px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0 ${
                    project.active == PROJECT_ACTIVE
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : project.active == PROJECT_PENDING
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                  }`}
                >
                  {proposalJSON?.nonProjectProposal
                    ? 'Non-project Proposal'
                    : project.active == PROJECT_ACTIVE
                    ? 'Active'
                    : project.active == PROJECT_PENDING
                    ? `Budget: ${proposalJSON?.ethBudget} ETH`
                    : 'Inactive'}
                </span>
              </div>
            </Link>
            {(project?.finalReportLink || project?.finalReportIPFS) && (
              <StandardButton
                className={`bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-fit text-sm px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ${
                  distribute && 'mr-4'
                }`}
                link={
                  project?.finalReportIPFS ? `/project/${project.id}` : project?.finalReportLink
                }
                onClick={(e: any) => {
                  e.stopPropagation()
                }}
                hoverEffect={false}
                target={project?.finalReportIPFS ? '_self' : '_blank'}
              >
                <p className="text-sm font-medium">📋 Final Report</p>
              </StandardButton>
            )}
          </div>
          {distribute &&
            (userContributed ? (
              <div className="flex flex-col items-end">
                <p className="text-gray-400">
                  {isMembershipDataLoading ? 'Checking...' : 'Contributed'}
                </p>
                {isMembershipDataLoading && (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mt-1"></div>
                )}
              </div>
            ) : (
              <NumberStepper
                number={distribution?.[project?.id] || 0}
                setNumber={(value: any) => {
                  if (distribution && handleDistributionChange) {
                    handleDistributionChange(String(project?.id), value)
                  }
                }}
                step={1}
                min={0}
                max={100}
                isDisabled={!userHasVotingPower}
              />
            ))}
          {!distribute && isVotingPeriod && (
            <div className="flex flex-col items-end">
              <p className="text-gray-400 text-sm">Not Eligible</p>
            </div>
          )}
        </div>
        <div className="flex gap-2"></div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="pr-2 break-words flex-1 flex flex-col justify-between">
            <div className="description-container flex-1 overflow-hidden min-h-[80px] max-h-[140px]">
              <p className="text-green-100 text-sm leading-relaxed flex-1 overflow-hidden line-clamp-6">
                {project.description?.length > characterLimit
                  ? `${project.description.substring(0, characterLimit)}...`
                  : project.description || 'No description available'}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-green-500/10 flex-shrink-0">
              <div className="text-green-300 text-xs font-medium hover:text-green-200 transition-colors">
                Click to view details →
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)
ProjectCardContent.displayName = 'ProjectCardContent'

export default function ProjectCard({
  project,
  projectContract,
  hatsContract,
  distribute,
  distribution,
  handleDistributionChange,
  userHasVotingPower,
  isVotingPeriod,
  active,
}: ProjectCardProps) {
  const account = useActiveAccount()
  const address = account?.address

  const { adminHatId } = useProjectData(projectContract, hatsContract, project)
  const { authenticated } = usePrivy()

  const { selectedChain } = useContext(ChainContextV5)
  const hats = useSubHats(selectedChain, adminHatId, !!project?.eligible)
  const wearers = useUniqueHatWearers(hats)

  // Improved contributor detection with both hat-based and rewardDistribution-based checks
  const userContributed = useMemo(() => {
    if (!address || !project || !authenticated) return false

    let isContributor = false
    if (wearers && address) {
      wearers.forEach((wearer: { address: string }) => {
        if (address.toLowerCase() === wearer['address'].toLowerCase()) {
          isContributor = true
        }
      })
    }

    let rewardDistributionContribution = false
    if (project.rewardDistribution) {
      try {
        const contributors: { [key: string]: number } = normalizeJsonString(
          project.rewardDistribution
        )
        rewardDistributionContribution = Object.keys(contributors).some(
          (contributor) => contributor.toLowerCase() === address.toLowerCase()
        )
      } catch (error) {
        console.error('Error parsing rewardDistribution:', error)
      }
    }

    return isContributor || rewardDistributionContribution
  }, [wearers, address, project])

  const isMembershipDataLoading = useMemo(() => {
    // Still loading if we have an adminHatId but no hats or wearers data yet
    const hatDataLoading = !!(adminHatId && (!hats || !wearers))

    const contributionCheckLoading =
      distribute &&
      address &&
      project &&
      !project.rewardDistribution && // No rewardDistribution data
      adminHatId && // Has adminHatId (so should have hat data)
      !wearers // But no wearers data yet

    return hatDataLoading || contributionCheckLoading
  }, [adminHatId, hats, wearers, distribute, address, project])

  if (!project) return null

  return (
    <>
      {distribute ? (
        <ProjectCardContent
          project={project}
          distribute={distribute}
          userContributed={userContributed}
          distribution={distribution}
          handleDistributionChange={handleDistributionChange}
          userHasVotingPower={userHasVotingPower}
          isMembershipDataLoading={isMembershipDataLoading}
          isVotingPeriod={isVotingPeriod}
          active={active}
        />
      ) : (
        <Link href={`/project/${project?.id}`} passHref>
          <ProjectCardContent
            project={project}
            userHasVotingPower={userHasVotingPower}
            isVotingPeriod={isVotingPeriod}
            active={active}
          />
        </Link>
      )}
    </>
  )
}
