import Image from 'next/image'
import { useEffect, useState } from 'react'
import useProjectData, { Project } from '@/lib/project/useProjectData'
import NumberStepper from '../layout/NumberStepper'

type ProjectCardProps = {
  project: Project
  distribution?: Record<string, number>
  handleDistributionChange?: (projectId: string, value: number) => void
}

export default function ProjectCard({
  project,
  distribution,
  handleDistributionChange,
}: ProjectCardProps) {
  const [projectMetadata, setProjectMetadata] = useState({
    name: '',
    description: '',
    image: '/assets/citizen-default.png',
  })

  const { proposalJSON } = useProjectData(project)

  useEffect(() => {
    if (proposalJSON?.abstract) {
      setProjectMetadata({
        name: project.title,
        image: '/assets/citizen-default.png',
        description: proposalJSON.abstract,
      })
    }
  }, [proposalJSON])

  return (
    <div
      id="card-container"
      className="animate-fadeIn flex flex-col gap-2 relative bg-dark-cool w-full h-full"
    >
      <div className="flex justify-between">
        <h1 className="font-GoodTimes">{project.title}</h1>
        {distribution && (
          <NumberStepper
            number={distribution?.[project.id] || 0}
            setNumber={(value: any) =>
              handleDistributionChange?.(project.id, value)
            }
            step={1}
            max={100}
          />
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex items-center gap-2">
          <Image
            src="/assets/project-lead.png"
            width={20}
            height={20}
            alt="Project Lead"
          />
          <p>{`Project Lead: ${''}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Image
            src="/assets/report.png"
            width={15}
            height={15}
            alt="Review Final Report"
          />
          <p>{'Review Final Report'}</p>
        </div>
      </div>
      <div>
        <p className="text-[80%]">{proposalJSON?.abstract}</p>
      </div>
    </div>
  )
}
