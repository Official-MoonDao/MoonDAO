//This component dipslays a project card using project data directly from tableland
import Image from 'next/image'
import Link from 'next/link'
import React, { memo } from 'react'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import NumberStepper from '../layout/NumberStepper'

type ProjectCardProps = {
  project: Project | undefined
  projectContract: any
  hatsContract: any
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
  }: any) => {
    return (
      <div
        id="card-container"
        className="animate-fadeIn flex flex-col gap-2 relative bg-dark-cool w-full h-full"
      >
        <div className="flex justify-between">
          <h1 className="font-GoodTimes">{project?.name || ''}</h1>
          {distribution && (
            <NumberStepper
              number={distribution?.[project?.id] || 0}
              setNumber={(value: any) =>
                handleDistributionChange?.(String(project?.id), value)
              }
              step={1}
              max={100}
            />
          )}
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
  distribution,
  handleDistributionChange,
}: ProjectCardProps) {
  const { proposalJSON, totalBudget } = useProjectData(
    projectContract,
    hatsContract,
    project
  )

  if (!project) return null

  return (
    <>
      {distribution ? (
        <ProjectCardContent
          project={project}
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
