import { useState } from 'react'
import toast from 'react-hot-toast'

type SubmitInfoModalProps = {
  action: Function
  quantity: number | string
  supply: number | string
  setEnabled: Function
  ttsContract: any
}

export function SubmitTTSInfoModal({
  action,
  quantity,
  supply,
  setEnabled,
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
        if (e.target.id === 'submit-tts-info-modal-backdrop') setEnabled(false)
      }}
      id="submit-tts-info-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-[300px] md:w-[500px] p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl">Submit Info</h1>
        <p className="opacity-50 mb-4">
          Please enter your full legal name (as displayed on a government issued
          photo ID) and the best email for us to contact you if you win a prize
          the Sweepstakes. By submitting your information, you agree to our
          Privacy Policy.
        </p>
        <label>Full Name</label>
        <input
          className="h-[50px] w-full text-lg rounded-sm px-2 bg-white bg-opacity-5 border-[1px] border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-40 focus:outline-none"
          onChange={(e) => setFullName(e.target.value)}
        />
        <label>Email</label>
        <input
          className="h-[50px] w-full text-lg rounded-sm px-2 bg-white bg-opacity-5 border-[1px] border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-40 focus:outline-none"
          onChange={(e) => setFullName(e.target.value)}
        />
        <div className="flex w-full justify-between pt-8">
          <button
            type="button"
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
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
