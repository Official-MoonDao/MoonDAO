import { getNFT } from 'thirdweb/extensions/erc721'
import { MediaRenderer, useReadContract } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'

type CompetitorPreviewProps = {
  teamId: any
  teamContract?: any
}

export function CompetitorPreview({
  teamId,
  teamContract,
}: CompetitorPreviewProps) {
  const { data: teamNFT } = useReadContract(getNFT, {
    contract: teamContract,
    tokenId: BigInt(teamId),
  })

  return (
    <div className="flex items-center gap-5">
      {teamNFT && teamNFT?.metadata && (
        <div className="flex items-center">
          <MediaRenderer
            client={client}
            src={teamNFT?.metadata?.image}
            width="66px"
            height="66px"
            style={{ borderRadius: '50%' }}
          />
          <div>{teamNFT?.metadata?.name}</div>
        </div>
      )}
    </div>
  )
}
