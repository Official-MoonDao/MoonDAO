import { useWallets } from '@privy-io/react-auth'
import { useAddress } from '@thirdweb-dev/react'
import { BigNumber } from 'ethers'
import { useState } from 'react'
import { useContext } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'

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

const TICKET_TO_SPACE_ADDRESS = '0x2b9496C22956E23CeC73299B9d3d3b7A9483D6Ff' //mumbai address

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

  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const [status, setStatus] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [fullName, setFullName] = useState<string>('')

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

    console.log(nftsToSubmit)
    return nftsToSubmit
  }

  async function signMessage() {
    const provider = await wallets[selectedWallet].getEthersProvider()
    const signer = provider?.getSigner()
    const response = await fetch(`api/db/nonce?address=${address}`)
    const data = await response.json()
    console.log(data)
    let message = "Please sign for verify and register your new NFTs into the sweepstakes. #" + data.nonce;
    const signature = await signer.signMessage(message)
    return signature
  }

  async function submitInfoToDB(tokenId: number | string, signature: string) {
    try {
      console.log(signature)
      console.log(address)
      fetch(`/api/db/nft?address=${address}`, {
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
    }
  }

  async function claimFreeTicket(claimFree: Function) {
    setStatus('Claiming free ticket...')
    const claimFreeTx = await claimFree()
    setStatus('')

    const newBalance = await ttsContract.call('balanceOf', [address])

    if (newBalance.toString() > balance.toString()) {
      toast.success('You successfully claimed your free ticket!')
    } else {
      toast.error('Claiming failed')
      throw new Error('Claiming failed')
    }
  }

  async function mintTicket(approveToken: Function, mint: Function) {
    //check mooney balance
    const mooneyBalance = await mooneyContract.call('balanceOf', [address])

    if (mooneyBalance.toString() < 20000 * quantity * 10 ** 18) {
      toast.error(
        'You do not have enough Mooney to mint this ticket. Please purchase more Mooney and try again.'
      )
      throw new Error('Not Enough Mooney')
    }

    //check token allowance
    const tokenAllowance = await mooneyContract.call('allowance', [
      address,
      TICKET_TO_SPACE_ADDRESS,
    ])

    if (tokenAllowance.toString() < 20000 * quantity * 10 ** 18) {
      setStatus('Approving token allowance...')
      const approvalTx = await approveToken()
      setStatus('')

      //check if approval was successful
      const newTokenAllowance = await mooneyContract.call('allowance', [
        address,
        TICKET_TO_SPACE_ADDRESS,
      ])

      if (newTokenAllowance.toString() >= 20000 * quantity * 10 ** 18) {
        setStatus('Minting ticket...')
        const mintTx = await mint()
        setStatus('')
      } else {
        console.log(newTokenAllowance.toString())
        setStatus('')
        toast.error('Token approval failed')
        throw new Error('Token Approval Error')
      }
    } else {
      setStatus('Minting ticket...')
      const mintTx = await mint()
      setStatus('')
    }

    const ownedNfts = await ttsContract.erc721.getOwnedTokenIds(address)
    console.log(ownedNfts)

    if (ownedNfts.length == parseInt(balance) + parseInt(quantity))
      toast.success(
        `You successfully minted ${quantity} Ticket to Space ${
          quantity === 1 ? 'NFT' : 'NFTs'
        }!`
      )
    else {
      console.log(balance)
      console.log(quantity)
      console.log(parseInt(balance) + parseInt(quantity))
      console.log(ownedNfts.length)
      toast.error('Minting failed')
      throw new Error('Minting error')
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
        <h1 className="text-2xl text-white">Win a Prize in the Sweepstakes</h1>
        <p className="opacity-50 mb-4 text-gray-300">
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
        <label className="text-white">Full Name</label>
        <input
          className="h-[50px] w-full text-lg rounded-sm px-2 bg-white bg-opacity-5 border-[1px] border-white group hover:border-orange-500 border-opacity-20 hover:border-opacity-40 focus:outline-none"
          onChange={(e) => setFullName(e.target.value)}
        />
        <label className="text-white">Email</label>
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
                if (!email || !fullName || !email.includes('@'))
                  return toast.error('Please fill in all fields')

                // Get list of NFT the address currently holds
                const prevNFTBalance =
                  await ttsContract.erc721.getOwnedTokenIds(address)
                console.log(prevNFTBalance)

                //CLaim Free Ticket
                if (claimFree) {
                  await claimFreeTicket(claimFree)
                  //Approve Mooney & Mint Ticket
                } else if (approveToken && mint) {
                  await mintTicket(approveToken, mint)
                }

                setStatus('Verifying identity...')

                const newNFTBalance = await ttsContract.erc721.getOwnedTokenIds(
                  address
                )
                console.log(newNFTBalance)

                const nftsToSubmit = filterNewNFTS(
                  prevNFTBalance,
                  newNFTBalance
                )

                try {
                  const signature = await signMessage()

                  for (let i = 0; i < nftsToSubmit.length; i++) {
                    await submitInfoToDB(nftsToSubmit[i], signature)
                  }
                } catch (err: any) {
                  console.log(err.message)
                  toast.error(
                    'Error verifying NFT identity. Please contact MoonDAO support'
                  )
                  return setEnabled(false)
                }

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
        <p>{status}</p>
      </div>
    </div>
  )
}
