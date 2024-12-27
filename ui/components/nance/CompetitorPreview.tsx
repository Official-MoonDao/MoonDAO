import { NFT, ThirdwebNftMedia } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'

type CompetitorPreviewProps = {
  teamId: any
  teamContract?: any
}

export function CompetitorPreview({
  teamId,
  teamContract,
}: CompetitorPreviewProps) {
  const [teamNFT, setTeamNFT] = useState<NFT>()

  useEffect(() => {
    async function getTeamNFT() {
      const nft = await teamContract.erc721.get(teamId)
      setTeamNFT(nft)
    }

    if (teamContract?.erc721?.get && teamId) {
      getTeamNFT()
    }
  }, [teamId, teamContract])
  console.log('teamNFT:', teamNFT)

  return (
    <div className="flex items-center gap-5">
      {teamNFT && (
        <div className="flex items-center">
          <ThirdwebNftMedia
            metadata={teamNFT.metadata}
            width="66px"
            height="66px"
            style={{ borderRadius: '50%' }}
          />
          <div>{teamNFT.metadata.name}</div>
        </div>
      )}
    </div>
  )
}
