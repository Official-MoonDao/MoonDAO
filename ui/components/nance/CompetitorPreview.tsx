import { useEffect, useState } from 'react'
import { loadOwnerNft } from '@/lib/tableland/tableNft'
import IPFSRenderer from '../layout/IPFSRenderer'

type CompetitorPreviewProps = {
  teamId: any
  teamContract?: any
}

export function CompetitorPreview({ teamId, teamContract }: CompetitorPreviewProps) {
  const [teamNFT, setTeamNFT] = useState<any>()

  useEffect(() => {
    const chain = teamContract?.chain
    if (!chain || teamId === undefined || teamId === null) return
    let cancelled = false
    loadOwnerNft(chain, teamId).then((nft) => {
      if (!cancelled) setTeamNFT(nft)
    })
    return () => {
      cancelled = true
    }
  }, [teamContract, teamId])

  return (
    <div className="flex items-center gap-5">
      {teamNFT?.metadata?.name && (
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
