import { useWallets } from '@privy-io/react-auth'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { ethereum, polygon } from '@/lib/rpc/chains'

type SubmitInfoModalPropsETH = {
  quantity: any
  setEnabled: Function
  setChain: Function
  selectedChain: any
  mooneyContract: any
  burn?: Function
}

const TICKET_TO_SPACE_ADDRESS = '0x6434c90c9063F0Bed0800a23c75eBEdDF71b6c52' //prod address
// const TICKET_TO_SPACE_ADDRESS = '0x2b9496C22956E23CeC73299B9d3d3b7A9483D6Ff' //test address

export function SubmitTTSInfoModalETH({
  quantity,
  setEnabled,
  selectedChain,
  setChain,
  mooneyContract,
  burn,
}: SubmitInfoModalPropsETH) {
  const account = useActiveAccount()
  const address = account?.address

  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [status, setStatus] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [fullName, setFullName] = useState<string>('')
  const [checkBoxEnabled, setCheckBoxEnabled] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)

  function timeout(delay: number) {
    return new Promise((res) => setTimeout(res, delay))
  }

  async function signMessage() {
    const provider = await wallets[selectedWallet].getEthersProvider()
    const signer = provider?.getSigner()
    const response = await fetch(
      `api/db/nonce?address=${address}&subscribed=${checkBoxEnabled}`
    )
    const data = await response.json()
    let message =
      'Please sign for verify and register your new NFTs into the sweepstakes. #' +
      data.nonce
    const signature = await signer.signMessage(message)
    return signature
  }

  async function submitNftToDB(tokenId: number | string, signature: string) {
    try {
      await fetch(`/api/db/mainnetTx?address=${address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'moondao-api-key': signature,
        } as any,
        body: JSON.stringify({
          state: 'PENDING',
          email: email,
          name: fullName,
          address: address,
        }),
      })
    } catch (err) {
      toast.error(
        'There was an issue adding your info to the database. Please contact a moondao member.'
      )
      setSubmitting(false)
    }
  }

  async function submitUserToDB(signature: string) {
    try {
      await fetch(`/api/db/user?address=${address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'moondao-api-key': signature,
        } as any,
        body: JSON.stringify({
          email: email,
          name: fullName,
          address: address,
        }),
      })
    } catch (err) {
      toast.error(
        'There was an issue adding your info to the database. Please contact a moondao member.'
      )
      setSubmitting(false)
    }
  }

  async function getUserNfts(signature: string) {
    try {
      await fetch(`/api/db/mainnetTx/?address=${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'moondao-api-key': signature,
        } as any,
      }).then((data: any) => {
        return data.json().length
      })
    } catch (err) {
      toast.error('Error reserving NFTs. Please try again.')
      setSubmitting(false)
    }
  }

  async function burnMooney(burn: Function) {
    //check mooney balance
    const mooneyBalance = await readContract({
      contract: mooneyContract,
      method: 'balanceOf' as string,
      params: [address],
    })

    if (+mooneyBalance.toString() < 20000 * quantity * 10 ** 18) {
      toast.error(
        'You do not have enough Mooney to reserve this ticket. Please purchase more Mooney and try again.'
      )
      setSubmitting(false)
      throw new Error('Not Enough Mooney')
    }

    await burn() //rejected by user?
    setStatus('')
  }

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'submit-tts-info-modal-backdrop' && !submitting) {
          setChain(polygon.id)
          setEnabled(false)
        }
      }}
      id="submit-tts-info-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000] overflow-scroll"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md mt-12">
        <h1 className="text-2xl text-white">Win a Prize in the Sweepstakes</h1>
        <p className="mb-2 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white p-2 font-[Lato]">
          You are acquiring your NFT using $MOONEY on the Ethereum chain. After
          confirming your transaction your NFT will be minted on the Polygon
          chain to the same wallet address within 24 hours.
        </p>
        <p className="opacity-50 mb-4 text-gray-300 p-2 font-[Lato]">
          Please enter your{' '}
          <span className="font-black text-moon-gold">full legal name</span> (as
          displayed on a government issued photo ID) and the best email for us
          to contact you if you win a prize the Sweepstakes. By submitting your
          information, you agree to our
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
        <div className="flex items-center">
          <input
            checked={checkBoxEnabled}
            onClick={() => setCheckBoxEnabled(!checkBoxEnabled)}
            id="checked-checkbox"
            type="checkbox"
            value=""
            className="my-4 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <label
            htmlFor="checked-checkbox"
            className="ms-2 text-sm font-medium text-white dark:text-gray-300"
          >
            Subscribe to our mailing list!
          </label>
        </div>
        <div className="flex w-full justify-between">
          <button
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-[#2A2A2A] text-base font-medium text-white enabled:hover:bg-white enabled:hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange disabled:opacity-50"
            onClick={() => {
              setChain(polygon)
              setEnabled(false)
            }}
            disabled={submitting}
          >
            Back
          </button>
          <button
            type="button"
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white enabled:hover:bg-white enabled:hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange disabled:opacity-50"
            disabled={submitting}
            onClick={async () => {
              if (wallets[selectedWallet].chainId.split(':')[1] !== '1') {
                wallets[selectedWallet].switchChain(ethereum.id)
                return toast.error('Please switch to Ethereum.')
              }

              try {
                if (!email || !fullName || !email.includes('@'))
                  return toast.error('Please fill in all fields.')

                setStatus('Reserving ticket')

                setSubmitting(true)
                const signature = await signMessage()
                console.log(signature)

                // Add user info to database
                await submitUserToDB(signature)

                // Get user NFTs from database. If the sum of the amount they are trying to reserve and the amount in the db is greater than 50, then throw an error.
                const userNFTs: any = await getUserNfts(signature)

                if (quantity > 50 - userNFTs) {
                  toast.error(
                    'You are reserving more NFTs than you are allowed. Currently there are ' +
                      userNFTs +
                      ' NFTs reserved under your address.'
                  )
                  setChain(polygon)
                  return setEnabled(false)
                }

                // Perform the MOONEY burn
                if (burn) {
                  await burnMooney(burn)
                }

                setStatus('Verifying identity')

                // Add Reserved NFTs to database
                try {
                  for (let i = 0; i < quantity; i++) {
                    await submitNftToDB('pending', signature)
                  }
                } catch (err: any) {
                  toast.error(
                    'Error verifying identity. Please contact MoonDAO support.'
                  )
                  setChain(polygon)
                  return setEnabled(false)
                }

                toast.success(
                  'Your NFT(s) have been reserved! They will be sent to your polygon wallet within 24 hours.'
                )

                setChain(polygon)
                setEnabled(false)
              } catch (err: any) {
                console.log(err.message)
              }
            }}
          >
            Submit
          </button>
        </div>
        <p className="flex mt-3 gap-3 text-lg">
          {status}
          {status && (
            <div className="flex flex-col justify-center items-center gap-2">
              <div
                className="inline-block h-5 w-5 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                role="status"
              />
            </div>
          )}
        </p>
      </div>
    </div>
  )
}
