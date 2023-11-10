import { useState } from 'react'
import toast from 'react-hot-toast'

type SubmitInfoModalProps = {
  action: Function
  quantity: number | string
  supply: number | string
  setEnableSubmitInfoModal: Function
  ttsContract: any
}

export function SubmitTTSInfoModal({
  action,
  quantity,
  supply,
  setEnableSubmitInfoModal,
  ttsContract,
}: SubmitInfoModalProps) {
  const [email, setEmail] = useState<string>('')
  const [fullName, setFullName] = useState<string>('')

  async function submitInfoToDB(tokenId: number | string) {
    try {
      const res = await fetch('/api/db/nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId,
          email,
          name: fullName,
        }),
      })
      console.log(res)
    } catch (err) {
      toast.error(
        'There was an issue adding your info to the database. Please contact a moondao member.'
      )
    }
  }

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'submit-tts-info-modal-backdrop')
          setEnableSubmitInfoModal(false)
      }}
      id="submit-tts-info-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#ffffff25] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-center w-[300px] md:w-[400px] p-8 bg-background-light dark:bg-background-dark">
        <div className="w-full text-right">
          <button onClick={() => setEnableSubmitInfoModal(false)}>✖</button>
        </div>
        <h1 className="text-2xl">Submit Info</h1>
        <p className="opacity-50">
          {
            'Please enter your fullname (as displayed on your id) and your email to enter the sweepstakes.'
          }
        </p>
        <label>Full Name :</label>
        <input
          className="text-black rounded-sm px-2"
          onChange={(e) => setFullName(e.target.value)}
        />
        <label>Email :</label>
        <input
          className="text-black rounded-sm px-2"
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="button"
          className="inline-flex my-2 justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange sm:ml-3 sm:w-auto sm:text-sm"
          onClick={async () => {
            if (!email || !fullName || !email.includes('@'))
              return toast.error('Please fill in all fields')

            const tx = await action()

            if (tx) {
              toast.success(
                `You successfully minted ${quantity} Ticket to Space ${
                  quantity === 1 ? 'NFT' : 'NFTs'
                }!`
              )

              //find owned tokenIds that aren't in the database yet
              const verifiedNftsRes = await fetch('/api/db/nft')
              const { data: verifiedNfts } = await verifiedNftsRes.json()

              const ownedNfts = await ttsContract.erc721.getOwned()

              const nftsNotInDatabase = ownedNfts.filter(
                (nft: any) =>
                  !verifiedNfts.find(
                    (vNft: any) => vNft.tokenId === nft.metadata.id
                  )
              )

              for (let i = 0; i < nftsNotInDatabase.length; i++) {
                await submitInfoToDB(nftsNotInDatabase[i].metadata.id)
              }

              toast.success('Your info has been added to the database!')
            }
          }}
        >
          Submit
        </button>
      </div>
    </div>
  )
}
