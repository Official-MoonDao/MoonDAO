//This component dipslays a project card using project data directly from tableland
import Link from 'next/link'
import React, { useContext, memo, useState, useMemo, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import { usePrivy } from '@privy-io/react-auth'
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
  isVotingPeriod?: boolean
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
    isVotingPeriod,
  }: any) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const description = project && project.MDP < 13
      ? project.description
      : proposalJSON?.abstract || project?.description || ''
    
    // Set character limits that better match the compact card height
    const [characterLimit, setCharacterLimit] = useState(400)
    
    useEffect(() => {
      const handleResize = () => {
        if (typeof window !== 'undefined') {
          // Adjust limits for the more compact 240px height
          setCharacterLimit(window.innerWidth >= 1024 ? 450 : 400)
        }
      }
      
      if (typeof window !== 'undefined') {
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }
    }, [])
    
    const isLongText = description.length > characterLimit
    const shouldTruncate = isLongText && !isExpanded
    const truncatedDescription = shouldTruncate 
      ? description.slice(0, characterLimit) + '...'
      : description

    return (
      <div
        id="card-container"
        className="p-4 pb-6 flex flex-col gap-2 relative w-full h-[260px] min-h-[260px] max-h-[260px] overflow-hidden"
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
          {!distribute && isVotingPeriod && (
            <div className="flex flex-col items-end">
              <p className="text-gray-400 text-sm">Not Eligible</p>
            </div>
          )}
        </div>
        <div className="flex gap-2"></div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="pr-4 break-words flex-1 flex flex-col justify-between">
            <div className="description-container flex-1 overflow-hidden min-h-[60px] max-h-[140px]">
              <ReactMarkdown
                components={{
                  p: ({ node, ...props }) => (
                    <p
                      className="font-Lato text-[16px] break-words m-0 leading-snug mb-1"
                      {...props}
                    />
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      className="font-Lato text-[14px] text-moon-blue hover:text-moon-gold underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      {...props}
                    />
                  ),
                }}
              >
                {shouldTruncate ? truncatedDescription : description}
              </ReactMarkdown>
            </div>
            <div className="flex-shrink-0 mt-2 min-h-[28px] pb-1">
              {isLongText && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExpanded(!isExpanded)
                  }}
                  className="text-blue-400 hover:text-blue-300 text-sm underline transition-colors"
                >
                  {isExpanded ? 'Read less' : 'Read more'}
                </button>
              )}
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
}: ProjectCardProps) {
  const account = useActiveAccount()
  const address = account?.address

  const { adminHatId, proposalJSON } = useProjectData(
    projectContract,
    hatsContract,
    project
  )
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
          distribute={
            distribute && (project!.finalReportLink || project!.finalReportIPFS)
          }
          userContributed={userContributed}
          distribution={distribution}
          handleDistributionChange={handleDistributionChange}
          proposalJSON={proposalJSON}
          userHasVotingPower={userHasVotingPower}
          isMembershipDataLoading={isMembershipDataLoading}
          isVotingPeriod={isVotingPeriod}
        />
      ) : (
        <Link href={`/project/${project?.id}`} passHref>
          <ProjectCardContent
            project={project}
            proposalJSON={proposalJSON}
            userHasVotingPower={userHasVotingPower}
            isVotingPeriod={isVotingPeriod}
          />
        </Link>
      )}
    </>
  )
}
