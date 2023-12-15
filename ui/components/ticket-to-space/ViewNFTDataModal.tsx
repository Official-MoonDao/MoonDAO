import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { BigNumber } from 'ethers'
import { useState, useEffect } from 'react'
import { useContext } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'

type ViewNFTDataModalProps = {
  ttsContract: any
  setEnabled: Function
}

export function ViewNFTDataModal({
  ttsContract,
  setEnabled,
}: ViewNFTDataModalProps) {
  const address = useAddress()

  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [isLoading, setIsLoading] = useState(true)
  const [userNFTs, setUserNFTs] = useState<
    {
      id: any
      name: any
      email: any
    }[]
  >([])

  async function signMessage() {
    const provider = await wallets[selectedWallet].getEthersProvider()
    const signer = provider?.getSigner()
    const response = await fetch(`api/db/nonce?address=${address}`)
    const data = await response.json()
    let message = "Please sign for verify and register your new NFTs into the sweepstakes. #" + data.nonce;
    const signature = await signer.signMessage(message)
    return signature
  }

  async function fetchInfoFromDB() {
    const signature = await signMessage()
    const ownedNfts = await ttsContract.erc721.getOwnedTokenIds(address)

    //find owned tokenIds in the databse
    const verifiedNftsRes = await fetch(`/api/db/nft?address=${address}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'moondao-api-key': signature,
      } as any,
    })

    console.log(verifiedNftsRes)

    const { data: verifiedNfts } = await verifiedNftsRes.json()
    console.log(verifiedNfts)
    console.log(ownedNfts)

    let nftsList = []
    for (let i = 0; i < ownedNfts.length; i++) {
        let found = false
        for (let j = 0; j < verifiedNfts.length; j++) {
            if (ownedNfts[i]._hex == verifiedNfts[j].tokenId) {
                nftsList.push({"id": ownedNfts[i]._hex, "name": verifiedNfts[j].name, "email": verifiedNfts[j].email})
                found = true
                break
            }
        }
        if (!found)
            nftsList.push({"id": ownedNfts[i]._hex, "name": "unverified", "email": "unverified"})
    }

    setUserNFTs(nftsList)

    console.log(nftsList)

    setIsLoading(false)
  }

  useEffect(() => {
    fetchInfoFromDB()
  }, [])

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
          If an NFT is registered with the wrong name or has any errors, please
          contact MoonDAO Support at support@moondao.com.
        </p>

        {isLoading ? (
          <p>
            Please sign the message in your wallet to view your Verified NFTs
          </p>
        ) : (
          <div className="overflow-visible w-full">
            {userNFTs.map((nft, i) => (
              <div
                key={'nft' + nft.id + i}
                className="flex flex-row gap-2 mt-1"
              >
                <div>{Number(nft.id)}:</div>
                <div className="ml">{nft.name}</div>
                {nft.email != 'unverified' && <div>- {nft.email}</div>}
              </div>
            ))}
          </div>
        )}

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
