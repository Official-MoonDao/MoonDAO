//This component dipslays a project card using project data directly from tableland
import Link from 'next/link'
import React, { useContext, memo, useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { normalizeJsonString } from '@/lib/utils/rewards'
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
}

const ProjectCardContent = memo(
  ({
    project,
    distribution,
    handleDistributionChange,
    proposalJSON,
    distribute,
    userContributed,
    userHasVotingPower,
    isMembershipDataLoading,
  }: any) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const description = proposalJSON?.abstract || ''
    const isLongText = description.length > 200
    const shouldTruncate = isLongText && !isExpanded

    return (
      <div
        id="card-container"
        className="p-4 pb-10 flex flex-col gap-2 relative w-full h-full flex-1"
      >
        <div className="flex justify-between">
          <div className="w-full flex flex-col gap-2">
            <Link href={`/project/${project?.id}`} passHref>
              <h1 className="font-GoodTimes">{project?.name || ''}</h1>
            </Link>
            {project?.finalReportLink || project?.finalReportIPFS ? (
              <StandardButton
                className={`gradient-2 w-fit font-[14px] ${
                  distribute && 'mr-4'
                }`}
                link={
                  project?.finalReportIPFS
                    ? `/project/${project.id}`
                    : project?.finalReportLink
                }
                onClick={(e: any) => {
                  e.stopPropagation()
                }}
                hoverEffect={false}
                target={project?.finalReportIPFS ? '_self' : '_blank'}
              >
                <p className="text-[14px]">Review Final Report</p>
              </StandardButton>
            ) : (
              <></>
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
        </div>
        <div className="flex gap-2"></div>
        <div className="flex-1">
          <div className="pr-4 break-words">
            <div
              className={`md:max-h-none ${
                shouldTruncate ? 'max-h-24 overflow-hidden relative' : ''
              }`}
            >
              <ReactMarkdown
                components={{
                  p: ({ node, ...props }) => (
                    <p
                      className="font-Lato text-[16px] break-words m-0"
                      {...props}
                    />
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      className="font-Lato text-[16px] text-moon-blue hover:text-moon-gold underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      {...props}
                    />
                  ),
                }}
              >
                {description}
              </ReactMarkdown>
              {shouldTruncate && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-900 to-transparent md:hidden"></div>
              )}
            </div>
            {isLongText && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
                className="text-blue-400 hover:text-blue-300 text-sm mt-2 underline md:hidden transition-colors"
              >
                {isExpanded ? 'Read less' : 'Read more'}
              </button>
            )}
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
}: ProjectCardProps) {
  const account = useActiveAccount()
  const address = account?.address

  const { adminHatId, proposalJSON } = useProjectData(
    projectContract,
    hatsContract,
    project
  )

  const { selectedChain } = useContext(ChainContextV5)
  const hats = useSubHats(selectedChain, adminHatId, !!project?.eligible)
  const wearers = useUniqueHatWearers(hats)

  // Improved contributor detection with both hat-based and rewardDistribution-based checks
  const userContributed = useMemo(() => {
    if (!address || !project) return false

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
          distribute={
            distribute && (project!.finalReportLink || project!.finalReportIPFS)
          }
          userContributed={userContributed}
          distribution={distribution}
          handleDistributionChange={handleDistributionChange}
          proposalJSON={proposalJSON}
          userHasVotingPower={userHasVotingPower}
          isMembershipDataLoading={isMembershipDataLoading}
        />
      ) : (
        <Link href={`/project/${project?.id}`} passHref>
          <ProjectCardContent
            project={project}
            proposalJSON={proposalJSON}
            userHasVotingPower={userHasVotingPower}
          />
        </Link>
      )}
    </>
  )
}
