import { useAddress } from '@thirdweb-dev/react'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

type ViewNFTDataModalProps = {
  ttsContract: any
  setEnabled: Function
}

export function ViewNFTDataModal({
  ttsContract,
  setEnabled,
}: ViewNFTDataModalProps) {
  const address = useAddress()

  const [isLoading, setIsLoading] = useState(true)

  async function fetchInfoFromDB() {
    try {
        const ownedNfts = await ttsContract.erc721.balanceOf(address)

        //find owned tokenIds that aren't in the database yet
        const verifiedNftsRes = await fetch('/api/db/nft', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'moondao-api-key':
              process.env.MONGO_MOONDAO_API_KEY,
          } as any,
        })

        const { data: verifiedNfts } = await verifiedNftsRes.json()
        console.log(verifiedNfts)

        const userNFTs = ownedNfts.filter(
          (nft: any) =>
            verifiedNfts.find(
              (vNft: any) => vNft.owner === nft.metadata.id
            )
        )

        console.log(userNFTs)

        setIsLoading(false)
    } catch (err) {
    //   toast.error(
    //     'There was an issue retreiving your info to the database. Please refresh or contact a moondao member.'
    //   )
    }
  }

  useEffect(() => {
    fetchInfoFromDB()
  })

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'submit-tts-info-modal-backdrop') setEnabled(false)
      }}
      id="submit-tts-info-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-[300px] md:w-[500px] p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl">View your NFTs</h1>
        <p className="opacity-50 mb-4">
          If an NFT is registered with the wrong name or has any errors, please contact MoonDAO Support at support@moondao.com.
        </p>



        <div className="flex w-full justify-between pt-8">
          <button
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-[#2A2A2A] text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={() => setEnabled(false)}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
