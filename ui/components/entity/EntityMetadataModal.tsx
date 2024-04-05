import { useWallets } from '@privy-io/react-auth'
import { useAddress, useResolvedMediaType } from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { pinMetadataToIPFS } from '@/lib/ipfs/pin'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'

export function EntityMetadataModal({ nft, entityContract, setEnabled }: any) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const address = useAddress()
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-metadata-modal-backdrop') setEnabled(false)
      }}
      id="entity-metadata-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl font-bold">Update Info</h1>
        <Widget
          className="w-[100%] md:w-[100%]"
          id={process.env.NEXT_PUBLIC_TYPEFORM_ENTITY_FORM_ID as string}
          onSubmit={async (formResponse: any) => {
            const provider = await wallets[selectedWallet].getEthersProvider()
            const signer = provider?.getSigner()

            const nonceRes = await fetch(`/api/db/nonce?address=${address}`)
            const nonceData = await nonceRes.json()

            const message = `Please sign this message to subit the form #`

            const signature = await signer.signMessage(
              message + nonceData.nonce
            )

            if (!signature) return toast.error('Error signing message')

            //get response from form
            const { formId, responseId } = formResponse
            const responseRes = await fetch(
              `/api/typeform/response?formId=${formId}&responseId=${responseId}`,
              {
                method: 'POST',
                headers: {
                  signature,
                },
                body: JSON.stringify({
                  address,
                  message,
                }),
              }
            )
            const data = await responseRes.json()

            console.log(data)

            const rawMetadataRes = await fetch(resolvedMetadata.url)
            const rawMetadata = await rawMetadataRes.json()
            const imageIPFSLink = rawMetadata.image

            const metadata = {
              name: data.answers[0].text,
              description: data.answers[1].text,
              image: imageIPFSLink,
              attributes: [
                {
                  trait_type: 'twitter',
                  value: data.answers[3].url,
                },
                {
                  trait_type: 'communications',
                  value: data.answers[4].url,
                },
                {
                  trait_type: 'website',
                  value: data.answers[2].url,
                },
                {
                  trait_type: 'view',
                  value:
                    data.answers[5].choice.label === 'Yes'
                      ? 'public'
                      : 'private',
                },
                {
                  trait_type: 'type',
                  value: 'entity',
                },
              ],
              formResponseId: responseId,
            }

            const jwtRes = await fetch('/api/ipfs/upload', {
              method: 'POST',
              headers: {
                signature,
              },
              body: JSON.stringify({
                address,
                message,
              }),
            })

            const pinataJWT = await jwtRes.text()

            const newMetadataIpfsHash = await pinMetadataToIPFS(
              pinataJWT || '',
              metadata,
              data.answers[0].text + ' Metadata'
            )

            if (!newMetadataIpfsHash)
              return toast.error('Error pinning metadata to IPFS')
            //mint NFT to safe
            await entityContract?.call('setTokenURI', [
              nft.metadata.id,
              'ipfs://' + newMetadataIpfsHash,
            ])

            router.reload()
          }}
          height={500}
        />
      </div>
    </div>
  )
}
