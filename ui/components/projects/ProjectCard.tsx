import Image from 'next/image'
import Link from 'next/link'
import useProjectData from '@/lib/project/useProjectData'
import NumberStepper from '../layout/NumberStepper'

type ProjectCardProps = {
  nft: any
  projectContract: any
  hatsContract: any
  distribution?: Record<string, number>
  handleDistributionChange?: (projectId: string, value: number) => void
}

export default function ProjectCard({
  nft,
  projectContract,
  hatsContract,
  distribution,
  handleDistributionChange,
}: ProjectCardProps) {
  const { proposalJSON, totalBudget } = useProjectData(
    projectContract,
    hatsContract,
    nft
  )

  return (
    <Link href={`/project/${nft.metadata.tokenId}`} passHref>
      <div
        id="card-container"
        className="animate-fadeIn flex flex-col gap-2 relative bg-dark-cool w-full h-full"
      >
        <div className="flex justify-between">
          <h1 className="font-GoodTimes">{nft?.metadata?.name || ''}</h1>
          {distribution && (
            <NumberStepper
              number={distribution?.[nft.metadata.tokenId] || 0}
              setNumber={(value: any) =>
                handleDistributionChange?.(nft.metadata.tokenId, value)
              }
              step={1}
              max={100}
            />
          )}
        </div>
        <div className="flex gap-2"></div>
        <div>
          <p className="text-[80%]">{proposalJSON?.abstract}</p>
          <div className="mt-2 flex items-center gap-2">
            <p>{`Awarded: ${totalBudget} ETH`}</p>
            <Image src="/coins/ETH.svg" alt="ETH" width={15} height={15} />
          </div>
        </div>
      </div>
    </Link>
  )
}
