import { useWallets } from '@privy-io/react-auth'
import { useAddress, useResolvedMediaType } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import { pinMetadataToIPFS } from '@/lib/ipfs/pin'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'

export function CitizenMetadataModal({
  nft,
  citizenContract,
  setEnabled,
}: any) {
  const router = useRouter()
  const address = useAddress()
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const [isLoading, setIsLoading] = useState(false)

  const [name, setName] = useState(nft.metadata.name)
  const [description, setDescription] = useState(nft.metadata.description)
  const [location, setLocation] = useState(nft.metadata.attributes[0].value)
  const [view, setView] = useState(nft.metadata.attributes[1].value)

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'citizen-metadata-modal-backdrop') setEnabled(false)
      }}
      id="citizen-metadata-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl font-bold">Update Info</h1>
        <h1 className="font-bold">Info</h1>
        <div className="w-full flex flex-col gap-4 text-black">
          <input
            className="border-2 px-4 py-2 w-full"
            placeholder="Entity Name"
            value={name}
            onChange={(e: any) => setName(e.target.value)}
          />
          <input
            className="border-2 px-4 py-2 w-full"
            placeholder="Entity Description"
            value={description}
            onChange={(e: any) => setDescription(e.target.value)}
          />
          <div className="flex gap-4">
            <p className="text-sm text-black dark:text-white">{`Would you like this nft to be publicly listed?`}</p>
            <input
              className="border-2 px-4 py-2"
              placeholder="Entity View"
              type="checkbox"
              defaultChecked={view}
              onChange={(e: any) =>
                e.target.checked ? setView('public') : setView('private')
              }
            />
          </div>
        </div>
        <button
          className="border-2 px-4 py-2"
          onClick={async () => {
            setIsLoading(true)
            try {
              const provider = await wallets[selectedWallet].getEthersProvider()
              const signer = provider?.getSigner()

              const nonceRes = await fetch(`/api/db/nonce?address=${address}`)

              const nonceData = await nonceRes.json()

              const message = `Please sign this message to update this entity's metadata #`

              const signature = await signer.signMessage(
                message + nonceData.nonce
              )

              if (!signature) return toast.error('Error signing message')

              const jwtRes = await fetch('/api/ipfs/upload', {
                method: 'POST',
                headers: {
                  signature,
                },
                body: JSON.stringify({ address: address, message }),
              })

              const JWT = await jwtRes.text()

              const rawMetadataRes = await fetch(resolvedMetadata.url)
              const rawMetadata = await rawMetadataRes.json()
              const imageIPFSLink = rawMetadata.image

              const metadata = {
                name: name,
                description: description,
                image: imageIPFSLink,
                attributes: [
                  {
                    trait_type: 'location',
                    value: location,
                  },
                  {
                    trait_type: 'view',
                    value: view,
                  },
                ],
              }

              const newMetadataIpfsHash = await pinMetadataToIPFS(
                JWT,
                metadata,
                nft?.metadata?.name + ' Metadata'
              )

              if (!newMetadataIpfsHash)
                return toast.error('Error pinning metadata to IPFS')

              await citizenContract.call('setTokenURI', [
                nft.metadata.id,
                'ipfs://' + newMetadataIpfsHash,
              ])

              router.reload()
            } catch (err) {
              console.log(err)
            }
          }}
        >
          Update
        </button>
      </div>
    </div>
  )
}
