import { useAddress } from '@thirdweb-dev/react'
import { useState } from 'react'
import toast from 'react-hot-toast'

type SubmitInfoModalProps = {
  balance: any
  quantity: any
  supply: number | string
  setEnabled: Function
  ttsContract: any
  mooneyContract: any
  claimFree?: Function
  approveToken?: Function
  mint?: Function
}

const TICKET_TO_SPACE_ADDRESS = '0x5283b6035cfa7bb884b7F6A146Fa6824eC9773c7' //mumbai address

export function SubmitTTSInfoModal({
  balance,
  quantity,
  supply,
  setEnabled,
  ttsContract,
  mooneyContract,
  claimFree,
  approveToken,
  mint,
}: SubmitInfoModalProps) {
  const address = useAddress()

  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [fullName, setFullName] = useState<string>('')

  async function submitInfoToDB(tokenId: number | string) {
    try {
      fetch('/api/db/nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        } as any,
        body: JSON.stringify({
          tokenId,
          email,
          name: fullName,
        }),
      })
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
        <h1 className="text-2xl">Win a Prize in the Sweepstakes</h1>
        <p className="opacity-50 mb-4">
          Please enter your full legal name (as displayed on a government issued
          photo ID) and the best email for us to contact you if you win a prize
          the Sweepstakes. By submitting your information, you agree to our
          <a
            className="text-moon-gold"
            href="https://publish.obsidian.md/moondao/MoonDAO/docs/Legal/Website+Privacy+Policy"
          >
            {' '}
            Privacy Policy
          </a>
          .
        </p>
        <label>Full Name</label>
        <input
          className="h-[50px] w-full text-lg rounded-sm px-2 bg-white bg-opacity-5 border-[1px] border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-40 focus:outline-none"
          onChange={(e) => setFullName(e.target.value)}
        />
        <label>Email</label>
        <input
          className="h-[50px] w-full text-lg rounded-sm px-2 bg-white bg-opacity-5 border-[1px] border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-40 focus:outline-none"
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex w-full justify-between pt-8">
          <button
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-[#2A2A2A] text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={() => setEnabled(false)}
          >
            Back
          </button>
          <button
            type="button"
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={async () => {
              try {
                setIsLoading(true)
                if (!email || !fullName || !email.includes('@'))
                  return toast.error('Please fill in all fields')

                //CLaim Free Ticket
                if (claimFree) {
                  setStatus('Claiming free ticket...')
                  const claimFreeTx = await claimFree()
                  setStatus('')

                  const newBalance = await ttsContract.call('balanceOf', [
                    address,
                  ])

                  if (newBalance.toString() > balance.toString()) {
                    toast.success('You successfully claimed your free ticket!')
                    setIsLoading(false)
                    setEnabled(false)
                  } else {
                    toast.error('Claiming failed')
                    return setIsLoading(false)
                  }

                  //Approve Mooney & Mint Ticket
                } else if (approveToken && mint) {
                  //check mooney balance
                  const mooneyBalance = await mooneyContract.call('balanceOf', [
                    address,
                  ])

                  if (mooneyBalance.toString() < 20000 * quantity * 10 ** 18) {
                    toast.error(
                      'You do not have enough Mooney to mint this ticket. Please purchase more Mooney and try again.'
                    )
                    return setIsLoading(false)
                  }

                  //check token allowance
                  const tokenAllowance = await mooneyContract.call(
                    'allowance',
                    [address, TICKET_TO_SPACE_ADDRESS]
                  )

                  if (tokenAllowance.toString() < 20000 * quantity * 10 ** 18) {
                    setStatus('Approving token allowance...')
                    const approvalTx = await approveToken()
                    setStatus('')

                    //check if approval was successful
                    const newTokenAllowance = await mooneyContract.call(
                      'allowance',
                      [address, TICKET_TO_SPACE_ADDRESS]
                    )

                    if (
                      newTokenAllowance.toString() >=
                      20000 * quantity * 10 ** 18
                    ) {
                      setStatus('Minting ticket...')
                      const mintTx = await mint()
                      setStatus('')
                    } else {
                      console.log(newTokenAllowance.toString())
                      setStatus('')
                      toast.error('Token approval failed')
                      return setIsLoading(false)
                    }
                  } else {
                    setStatus('Minting ticket...')
                    const mintTx = await mint()
                    setStatus('')
                  }

                  const ownedNfts = await ttsContract.erc721.getOwned()

                  if (ownedNfts.length > balance.toString())
                    toast.success(
                      `You successfully minted ${quantity} Ticket to Space ${
                        quantity === 1 ? 'NFT' : 'NFTs'
                      }!`
                    )
                  else {
                    toast.error('Minting failed')
                    return setIsLoading(false)
                  }
                  //find owned tokenIds that aren't in the database yet
                  const verifiedNftsRes = await fetch('/api/db/nft', {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    } as any,
                  })

                  const { data: verifiedNfts } = await verifiedNftsRes.json()

                  const nftsNotInDatabase = ownedNfts.filter(
                    (nft: any) =>
                      !verifiedNfts.find(
                        (vNft: any) => vNft.tokenId === nft.metadata.id
                      )
                  )

                  let postedToDatabase

                  for (let i = 0; i < nftsNotInDatabase.length; i++) {
                    await submitInfoToDB(nftsNotInDatabase[i].metadata.id)
                    postedToDatabase = true
                  }

                  if (postedToDatabase)
                    toast.success('Your info has been added to the database!')

                  setEnabled(false)
                  setIsLoading(false)
                }
              } catch (err: any) {
                console.log(err.message)
                setIsLoading(false)
              }
            }}
          >
            Submit
          </button>
        </div>
        <p>{status}</p>
      </div>
    </div>
  )
}
