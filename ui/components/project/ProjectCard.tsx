//This component dipslays a project card using project data directly from tableland
import { useAddress, useContract, useSDK } from '@thirdweb-dev/react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useContext, memo } from 'react'
import { useSubHats } from '@/lib/hats/useSubHats'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import ChainContext from '@/lib/thirdweb/chain-context'
import NumberStepper from '../layout/NumberStepper'

type ProjectCardProps = {
  project: Project | undefined
  projectContract: any
  hatsContract: any
  distribute?: boolean
  userContributed?: boolean
  distribution?: Record<string, number>
  handleDistributionChange?: (projectId: string, value: number) => void
}

const ProjectCardContent = memo(
  ({
    project,
    distribution,
    handleDistributionChange,
    proposalJSON,
    totalBudget,
    distribute,
    userContributed,
  }: any) => {
    return (
      <div
        id="card-container"
        className="p-4 pb-10 flex flex-col gap-2 relative bg-dark-cool w-full h-full rounded-2xl flex-1 border-b-2 border-[#020617]"
      >
        <div className="flex justify-between">
          <Link href={`/project/${project?.id}`} passHref>
            <h1 className="font-GoodTimes">{project?.name || ''}</h1>
          </Link>
          {project?.finalReportLink && (
            <Link href={project?.finalReportLink} target="_blank" passHref>
              <h3 className="text-[14px] font-medium font-GoodTimes">
                Review Final Report
              </h3>
            </Link>
          )}
          {distribute &&
            (userContributed ? (
              <p>Contributed</p>
            ) : (
              <NumberStepper
                number={distribution?.[project?.id] || 0}
                setNumber={(value: any) => {
                  if (distribution && handleDistributionChange) {
                    handleDistributionChange?.(String(project?.id), value)
                  }
                }}
                step={1}
                max={100}
              />
            ))}
        </div>
        <div className="flex gap-2"></div>
        <div>
          <p className="text-[80%] pr-4">{proposalJSON?.abstract}</p>
          <div className="mt-2 flex items-center gap-2">
            <p>{`Awarded: ${totalBudget} ETH`}</p>
            <Image src="/coins/ETH.svg" alt="ETH" width={15} height={15} />
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
}: ProjectCardProps) {
  const { adminHatId, proposalJSON, totalBudget } = useProjectData(
    projectContract,
    hatsContract,
    project
  )
  const { selectedChain } = useContext(ChainContext)
  const hats = useSubHats(selectedChain, adminHatId)
  const wearers = useUniqueHatWearers(hats)
  const address = useAddress()
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
          totalBudget={totalBudget}
        />
      ) : (
        <Link href={`/project/${project?.id}`} passHref>
          <ProjectCardContent
            project={project}
            proposalJSON={proposalJSON}
            totalBudget={totalBudget}
          />
        </Link>
      )}
    </>
  )
}
