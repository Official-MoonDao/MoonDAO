//This component dipslays a project card using project data directly from tableland
import Image from 'next/image'
import Link from 'next/link'
import React, { useContext, memo } from 'react'
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
    return (
      <div
        id="card-container"
        className="p-4 pb-10 flex flex-col gap-2 relative bg-dark-cool w-full h-full rounded-2xl flex-1 border-b-2 border-[#020617]"
      >
        <div className="flex justify-between">
          <div className="w-full flex flex-col xl:flex-row gap-2 xl:items-center justify-between">
            <Link href={`/project/${project?.id}`} passHref>
              <h1 className="font-GoodTimes">{project?.name || ''}</h1>
            </Link>
            {project?.finalReportLink || project?.finalReportIPFS ? (
              <StandardButton
                className={`gradient-2 xl:w-[200px] font-[14px] ${
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
        <div>
          <p className="text-[80%] pr-4 break-words">
            {proposalJSON?.abstract}
          </p>
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
