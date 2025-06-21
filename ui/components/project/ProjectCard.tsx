//This component dipslays a project card using project data directly from tableland
import Link from 'next/link'
import React, { useContext, memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useActiveAccount } from 'thirdweb/react'
import { useSubHats } from '@/lib/hats/useSubHats'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
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
              <p>Contributed</p>
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
            <div className={`md:max-h-none ${shouldTruncate ? 'max-h-24 overflow-hidden relative' : ''}`}>
              <ReactMarkdown
                components={{
                  p: ({ node, ...props }) => <p className="font-Lato text-[16px] break-words m-0" {...props} />,
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
  const hats = useSubHats(selectedChain, adminHatId)
  const wearers = useUniqueHatWearers(hats)

  let userContributed = false
  if (wearers && address) {
    wearers.forEach((wearer: { address: string }) => {
      if (address.toLowerCase() === wearer['address'].toLowerCase()) {
        userContributed = true
      }
    })
  }

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
          proposalJSON={proposalJSON}
          userHasVotingPower={userHasVotingPower}
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
