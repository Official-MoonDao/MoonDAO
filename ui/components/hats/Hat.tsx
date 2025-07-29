import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useHatData } from '@/lib/hats/useHatData'
import client from '@/lib/thirdweb/client'
import IPFSRenderer from '../layout/IPFSRenderer'

type HatProps = {
  selectedChain: any
  hatsContract: any
  hat: any
  teamImage?: boolean
  teamContract?: any
  compact?: boolean
  isDisabled?: boolean
}

// Loading skeleton components
const ImageSkeleton = ({ size }: { size: number }) => (
  <div
    className="rounded-[2.5vmax] rounded-tl-[10px] overflow-hidden animate-pulse bg-gray-300"
    style={{ width: size, height: size }}
  />
)

const TextSkeleton = ({
  width,
  height = 'h-4',
}: {
  width: string
  height?: string
}) => <div className={`animate-pulse bg-gray-300 rounded ${height} ${width}`} />

export function Hat({
  selectedChain,
  hatsContract,
  hat,
  teamImage,
  teamContract,
  compact,
  isDisabled,
}: HatProps) {
  const router = useRouter()
  const {
    hatData,
    isLoading: isHatLoading,
    error: hatError,
  } = useHatData(selectedChain, hatsContract, hat.id)
  const [teamNFT, setTeamNFT] = useState<any>()
  const [isTeamNFTLoading, setIsTeamNFTLoading] = useState(false)
  const [teamNFTError, setTeamNFTError] = useState<string | null>(null)

  useEffect(() => {
    async function getTeamNFT() {
      if (!teamContract || !hat?.teamId) return

      setIsTeamNFTLoading(true)
      setTeamNFTError(null)

      try {
        const nft = await getNFT({
          contract: teamContract,
          tokenId: BigInt(hat.teamId),
        })
        setTeamNFT(nft)
      } catch (error) {
        console.error('Error fetching team NFT:', error)
        setTeamNFTError('Failed to load team image')
        setTeamNFT(undefined)
      } finally {
        setIsTeamNFTLoading(false)
      }
    }

    getTeamNFT()
  }, [teamContract, hat?.teamId])

  const imageSize = compact ? 75 : 150

  return (
    <button
      className="text-left px-4 flex flex-col"
      onClick={() => {
        if (hat.teamId && !isDisabled) {
          router.push(`/team/${hat.teamId}`)
        }
      }}
    >
      <div className="flex items-center gap-5">
        {/* Team NFT Image or Loading State */}
        {teamContract && hat?.teamId && (
          <div className="rounded-[2.5vmax] rounded-tl-[10px] overflow-hidden">
            {isTeamNFTLoading ? (
              <ImageSkeleton size={imageSize} />
            ) : teamNFT ? (
              <IPFSRenderer
                src={teamNFT.metadata.image || ''}
                alt="Team Image"
                width={imageSize}
                height={imageSize}
                className="object-cover"
              />
            ) : teamNFTError ? (
              <div
                className="bg-gray-200 flex items-center justify-center text-gray-500 text-xs"
                style={{ width: imageSize, height: imageSize }}
              >
                Failed to load
              </div>
            ) : null}
          </div>
        )}

        {/* Hat Data or Loading State */}
        <div className="flex-1">
          {isHatLoading ? (
            <>
              <TextSkeleton width="w-32" height="h-5" />
              {!compact && (
                <div className="mt-2">
                  <TextSkeleton width="w-48" height="h-4" />
                </div>
              )}
            </>
          ) : hatError ? (
            <div className="text-red-500 text-sm">
              <p>Error loading hat data</p>
            </div>
          ) : (
            <>
              <p className="font-GoodTimes">
                {compact
                  ? teamNFT?.metadata?.name || hatData.name
                  : hatData.name}
              </p>
              {!compact && <p>{hatData.description}</p>}
            </>
          )}
        </div>

        {/* Arrow Icon */}
        {!compact && !isHatLoading && (
          <div>
            <ArrowUpRightIcon
              height={20}
              width={20}
              className="text-light-warm"
            />
          </div>
        )}
      </div>
    </button>
  )
}
