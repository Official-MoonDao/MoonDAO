import { useWallets } from '@privy-io/react-auth'
import { useState, useEffect } from 'react'
import { useContext } from 'react'
import { getOwnedNFTs } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { ReverifyModal } from './ReverifyModal'

type ViewNFTDataModalProps = {
  ttsContract: any
  setEnabled: Function
}

export function ViewNFTDataModal({
  ttsContract,
  setEnabled,
}: ViewNFTDataModalProps) {
  const account = useActiveAccount()
  const address = account?.address

  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [isLoading, setIsLoading] = useState(true)
  const [enableReverifyModal, setReverifyModal] = useState(false)
  const [reverifyNFTId, setReverifyNFTId] = useState<string[]>([])
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
    if (!data.nonce) return null
    let message =
      'Please sign for verify and register your new NFTs into the sweepstakes. #' +
      data.nonce
    const signature = await signer.signMessage(message)
    return signature
  }

  useEffect(() => {
    async function fetchInfoFromDB() {
      const signature = await signMessage()
      if (!signature || !address) return

      const ownedNfts = await getOwnedNFTs({
        contract: ttsContract,
        owner: address,
      })

      //find owned tokenIds in the databse
      const verifiedNftsRes = await fetch(`/api/db/nft?address=${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'moondao-api-key': signature,
        } as any,
      })

      const { data: verifiedNfts } = await verifiedNftsRes.json()

      if (!verifiedNfts) return

      const email = verifiedNfts.find(
        (nft: any) => nft.address === address && nft.email
      )?.email

      const name = verifiedNfts.find(
        (nft: any) => nft.address === address && nft.name
      )?.name

      let nftsList = []
      for (let i = 0; i < ownedNfts.length; i++) {
        let found = false
        for (let j = 0; j < verifiedNfts.length; j++) {
          if (ownedNfts[i].id == verifiedNfts[j].tokenId) {
            if (
              found &&
              Date.parse(nftsList[i].updateTime) <
                Date.parse(verifiedNfts[j].updatedAt)
            ) {
              nftsList[i] = {
                id: ownedNfts[i].id,
                name: verifiedNfts[j].name,
                email: verifiedNfts[j].email,
                updateTime: verifiedNfts[j].updatedAt,
              }
            } else {
              nftsList.push({
                id: ownedNfts[i].id,
                name: verifiedNfts[j].name,
                email: verifiedNfts[j].email,
                updateTime: verifiedNfts[j].updatedAt,
              })
            }
            found = true
          }
        }
        if (!found)
          nftsList.push({
            id: ownedNfts[i].id,
            name: name || 'Unverified',
            email: email || 'Unverified',
          })
      }

      setUserNFTs(nftsList)

      setIsLoading(false)
    }

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
      {enableReverifyModal && (
        <ReverifyModal
          setReverifyEnabled={setReverifyModal}
          setViewEnabled={setEnabled}
          nftIds={reverifyNFTId}
        />
      )}
      <div className="flex flex-col gap-2 items-start justify-start w-[300px] md:w-[500px] lg:w-[750px] p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl">View your NFTs</h1>
        <p className="opacity-50 mb-4 font-[Lato]">
          If an NFT is registered with the wrong name or has any errors, please
          contact MoonDAO Support at support@moondao.com.
        </p>

        {isLoading ? (
          <p className="font-[Lato]">
            Please sign the message in your wallet to view your Verified NFTs
          </p>
        ) : (
          <>
            <div className="overflow-visible w-full h-[200px] overflow-y-scroll">
              {userNFTs.map((nft, i) => (
                <div
                  key={'nft' + nft.id + i}
                  className="flex flex-row gap-2 mt-1"
                >
                  <div>{Number(nft.id)}:</div>
                  <div className="ml">{nft.name}</div>
                  {nft.email != 'Unverified' && <div>- {nft.email}</div>}
                  <button
                    onClick={() => {
                      setReverifyModal(true)
                      setReverifyNFTId([nft.id])
                    }}
                    className="text-moon-gold ml-2"
                  >
                    {nft.email == 'Unverified' ? 'Verify' : 'Edit'}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setReverifyModal(true)
                let nftsList: string[] = []
                userNFTs.map((nft) => nftsList.push(nft.id))
                setReverifyNFTId(nftsList)
              }}
              className="text-moon-gold mt-2 text-lg"
            >
              Reverify All
            </button>
          </>
        )}

        <div className="flex w-full justify-between pt-4">
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
