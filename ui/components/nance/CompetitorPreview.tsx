import Image from 'next/image'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useReadContract } from 'thirdweb/react'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
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
          <Image
            src={getIPFSGateway(teamNFT?.metadata?.image || '')}
            width={66}
            height={66}
            alt="Competitor Image"
            style={{ borderRadius: '50%' }}
          />
          <div>{teamNFT?.metadata?.name}</div>
        </div>
      )}
    </div>
  )
}
