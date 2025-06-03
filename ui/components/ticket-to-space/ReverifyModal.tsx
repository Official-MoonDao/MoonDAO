import { useWallets } from '@privy-io/react-auth'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'

type SubmitInfoModalProps = {
  setReverifyEnabled: Function
  setViewEnabled: Function
  nftIds: string[]
}

export function ReverifyModal({
  setReverifyEnabled,
  setViewEnabled,
  nftIds,
}: SubmitInfoModalProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [email, setEmail] = useState<string>('')
  const [fullName, setFullName] = useState<string>('')
  const [status, setStatus] = useState<string>('')

  async function signMessage() {
    setStatus('Signing...')
    const provider = await wallets[selectedWallet].getEthersProvider()
    const signer = provider?.getSigner()
    const response = await fetch(`api/db/nonce?address=${address}`)
    const data = await response.json()
    let message =
      'Please sign for verify and register your new NFTs into the sweepstakes. #' +
      data.nonce
    const signature = await signer.signMessage(message)
    setStatus('')
    return signature
  }

  const handleSubmit = async () => {
    if (!email || !fullName || !email.includes('@'))
      return toast.error('Please fill in all fields.')

    const signature = await signMessage()
    setStatus('Submitting...')

    let success = true
    for (let i = 0; i < nftIds.length; i++) {
      const res = await fetch(`/api/db/nft?address=${address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'moondao-api-key': signature,
        } as any,
        body: JSON.stringify({
          tokenId: nftIds[i],
          email,
          name: fullName,
          address: address,
        }),
      })
      setStatus('')
      const data = await res.json()
      if (!data.success) success = false
    }

    setReverifyEnabled(false)
    setViewEnabled(false)
    if (success) {
      toast.success("You're all set! There's nothing else you need to do.")
    } else {
      toast.error(
        'There was an issue adding your info to the database. Please contact a moondao member.'
      )
    }
  }

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'reverify-modal-backdrop') {
          setReverifyEnabled(false)
        }
      }}
      id="reverify-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-[300px] md:w-[500px] p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl text-white">
          Reverify {nftIds.length > 1 ? 'All NFTs' : 'NFT ' + Number(nftIds)}
        </h1>
        <p className="opacity-50 mb-4 text-gray-300 font-[Lato]">
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
        <label className="text-white">
          Full Legal Name (as appears on your ID)
        </label>
        <input
          className="h-[50px] w-full text-lg rounded-sm px-2 bg-white bg-opacity-5 border-[1px] border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-40 focus:outline-none"
          onChange={(e) => setFullName(e.target.value)}
        />
        <label className="text-white">Email</label>
        <input
          className="h-[50px] w-full text-lg rounded-sm px-2 bg-white bg-opacity-5 border-[1px] border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-40 focus:outline-none"
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex w-full justify-between">
          <button
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-[#2A2A2A] text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={() => {
              setReverifyEnabled(false)
            }}
          >
            Back
          </button>
          <button
            type="button"
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={async () => {
              handleSubmit()
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
