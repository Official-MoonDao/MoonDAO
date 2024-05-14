import { useWallets } from '@privy-io/react-auth'
import {
  useAddress,
  useContract,
  useResolvedMediaType,
} from '@thirdweb-dev/react'
import { Widget } from '@typeform/embed-react'
import { CITIZEN_TABLE_ADDRESSES } from 'const/config'
import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import { pinMetadataToIPFS } from '@/lib/ipfs/pin'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'

export function CitizenMetadataModal({ nft, selectedChain, setEnabled }: any) {
  const router = useRouter()
  const address = useAddress()
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const [isLoading, setIsLoading] = useState(false)

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  const { contract: citizenTableContract } = useContract(
    CITIZEN_TABLE_ADDRESSES[selectedChain.slug]
  )

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
        <Widget
          className="w-[100%] md:w-[100%]"
          id={process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string}
          onSubmit={async (formResponse: any) => {
            // sign message to get response
            const provider = await wallets[selectedWallet].getEthersProvider()
            const signer = provider?.getSigner()

            const nonceRes = await fetch(`/api/db/nonce?address=${address}`)
            const nonceData = await nonceRes.json()

            const message = `Please sign this message to submit the form #`

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

            const rawMetadataRes = await fetch(resolvedMetadata.url)
            const rawMetadata = await rawMetadataRes.json()
            const imageIPFSLink = rawMetadata.image

            await citizenTableContract?.call('updateTable', [
              nft.metadata.id,
              `${data.answers[0].text} ${data.answers[1].text}`,
              data.answers[3].text,
              imageIPFSLink,
              data.answers[7].text,
              data.answers[4].text,
              data.answers[6].url,
              data.answers[5].url,
              data.answers[8].choice.label === 'Yes' ? 'public' : 'private',
            ])

            router.reload()
          }}
          height={500}
        />
      </div>
    </div>
  )
}
