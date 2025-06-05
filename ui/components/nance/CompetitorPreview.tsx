import { getNFT } from 'thirdweb/extensions/erc721'
import { useReadContract } from 'thirdweb/react'
import IPFSRenderer from '../layout/IPFSRenderer'

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
          <IPFSRenderer
            className="rounded-[50%]"
            src={teamNFT?.metadata?.image || ''}
            width={66}
            height={66}
            alt="Competitor Image"
          />
          <div>{teamNFT?.metadata?.name}</div>
        </div>
      )}
    </div>
  )
}
