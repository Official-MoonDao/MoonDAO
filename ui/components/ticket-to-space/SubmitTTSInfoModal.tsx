import { useWallets } from '@privy-io/react-auth'
import { BigNumber } from 'ethers'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import { readContract } from 'thirdweb'
import { getOwnedNFTs } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { polygon } from '@/lib/rpc/chains'

type SubmitInfoModalProps = {
  balance: any
  quantity: any
  setEnabled: Function
  ttsContract: any
  mooneyContract: any
  claimFree?: Function
  approveToken?: Function
  mint?: Function
}

const TICKET_TO_SPACE_ADDRESS = '0x6434c90c9063F0Bed0800a23c75eBEdDF71b6c52' //prod address
// const TICKET_TO_SPACE_ADDRESS = '0x2b9496C22956E23CeC73299B9d3d3b7A9483D6Ff' //test address

export function SubmitTTSInfoModal({
  balance,
  quantity,
  setEnabled,
  ttsContract,
  mooneyContract,
  claimFree,
  approveToken,
  mint,
}: SubmitInfoModalProps) {
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

  function filterNewNFTS(
    prevNFTs: Array<BigNumber>,
    newNFTs: Array<BigNumber>
  ) {
    const nftsToSubmit = []
    for (let i = 0; i < newNFTs.length; i++) {
      let found = false
      for (let j = 0; j < prevNFTs.length; j++) {
        if (newNFTs[i]._hex == prevNFTs[j]._hex) {
          found = true
        }
      }
      if (!found) nftsToSubmit.push(newNFTs[i]._hex)
    }

    return nftsToSubmit
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

  async function submitInfoToDB(tokenId: number | string, signature: string) {
    try {
      await fetch(`/api/db/nft?address=${address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'moondao-api-key': signature,
        } as any,
        body: JSON.stringify({
          tokenId,
          email,
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

  async function claimFreeTicket(claimFree: Function) {
    setStatus('Claiming free ticket')
    await claimFree()
    setStatus('')

    const newBalance = await readContract({
      contract: ttsContract,
      method: 'balanceOf' as string,
      params: [address],
    })

    if (newBalance.toString() > balance.toString()) {
      toast.success('You successfully claimed your free ticket!')
      setSubmitting(false)
    } else {
      toast.error('Claiming failed.')
      setSubmitting(false)
      throw new Error('Claiming failed')
    }
  }

  async function mintTicket(approveToken: Function, mint: Function) {
    //check mooney balance
    const mooneyBalance = await readContract({
      contract: mooneyContract,
      method: 'balanceOf' as string,
      params: [address],
    })

    if (+mooneyBalance.toString() < 20000 * quantity * 10 ** 18) {
      toast.error(
        'You do not have enough Mooney to mint this ticket. Please purchase more Mooney and try again.'
      )
      setSubmitting(false)
      throw new Error('Not Enough Mooney')
    }

    //check token allowance
    const tokenAllowance = await readContract({
      contract: mooneyContract,
      method: 'allowance' as string,
      params: [address, TICKET_TO_SPACE_ADDRESS],
    })

    if (+tokenAllowance.toString() < 20000 * quantity * 10 ** 18) {
      setStatus('Approving token allowance')
      await approveToken()
      setStatus('')

      //check if approval was successful
      const newTokenAllowance = await readContract({
        contract: mooneyContract,
        method: 'allowance' as string,
        params: [address, TICKET_TO_SPACE_ADDRESS],
      })

      if (+newTokenAllowance.toString() >= 20000 * quantity * 10 ** 18) {
        setStatus('Minting ticket')
        await mint()
        setStatus('')
      } else {
        setStatus('')
        toast.error('Token approval failed.')
        setSubmitting(false)
        throw new Error('Token Approval Error')
      }
    } else {
      setStatus('Minting ticket')
      await mint()
      setStatus('')
    }

    if (!address) return

    const ownedNfts = await getOwnedNFTs({
      contract: ttsContract,
      owner: address,
    })

    if (ownedNfts.length == parseInt(balance) + parseInt(quantity)) {
      toast.success(
        `You successfully minted ${quantity} Ticket to Space ${
          quantity === 1 ? 'NFT' : 'NFTs'
        }!`
      )
    } else {
      toast.error('Minting failed.')
      setSubmitting(false)
      throw new Error('Minting error')
    }
  }

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'submit-tts-info-modal-backdrop' && !submitting)
          setEnabled(false)
      }}
      id="submit-tts-info-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl text-white">Win a Prize in the Sweepstakes</h1>
        <p className="opacity-50 mb-4 text-gray-300 font-[Lato]">
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
            onClick={() => setEnabled(false)}
            disabled={submitting}
          >
            Back
          </button>
          <button
            type="button"
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white enabled:hover:bg-white enabled:hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange disabled:opacity-50"
            disabled={submitting}
            onClick={async () => {
              try {
                if (wallets[selectedWallet].chainId.split(':')[1] !== '137') {
                  wallets[selectedWallet].switchChain(polygon.id)
                  return toast.error('Please switch to Polygon.')
                }
                if (!email || !fullName || !email.includes('@'))
                  return toast.error('Please fill in all fields.')

                setSubmitting(true)
                const signature = await signMessage()
                await submitInfoToDB('xxx', signature)

                // Get list of NFT the address currently holds
                if (!address) return

                const prevNFTBalance = await getOwnedNFTs({
                  contract: ttsContract,
                  owner: address,
                })

                //CLaim Free Ticket
                if (claimFree) {
                  await claimFreeTicket(claimFree)
                  //Approve Mooney & Mint Ticket
                } else if (approveToken && mint) {
                  await mintTicket(approveToken, mint)
                }

                setStatus('Verifying identity')

                await timeout(3000)

                const newNFTBalance = await getOwnedNFTs({
                  contract: ttsContract,
                  owner: address,
                })

                const nftsToSubmit = filterNewNFTS(
                  prevNFTBalance.map((nftId) => BigNumber.from(nftId)),
                  newNFTBalance.map((nftId) => BigNumber.from(nftId))
                )

                try {
                  for (let i = 0; i < nftsToSubmit.length; i++) {
                    await submitInfoToDB(nftsToSubmit[i], signature)
                  }
                } catch (err: any) {
                  toast.error(
                    'Error verifying NFT identity. Please contact MoonDAO support.'
                  )
                  return setEnabled(false)
                }

                await fetch('/api/convertkit', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'moondao-api-key': signature,
                  },
                  body: JSON.stringify({
                    userEmail: email,
                    name: fullName,
                  }),
                })

                toast.success('Your NFT(s) have been verified and registered!')

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
