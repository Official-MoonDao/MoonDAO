import { useWallets } from '@privy-io/react-auth'
import { useAddress, useSDK } from '@thirdweb-dev/react'
import Image from 'next/image'
import { useContext } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import TeamSplitABI from '../../const/abis/TeamSplit.json'
import { CopyIcon } from '../assets'
import StandardButton from '../layout/StandardButton'

type TeamTreasuryProps = {
  selectedChain: any
  multisigAddress: string
  splitAddress: string | undefined
  mutlisigMooneyBalance: any
  multisigNativeBalance: any
  splitMooneyBalance: any
  splitNativeBalance: any
}

export default function TeamTreasury({
  selectedChain,
  multisigAddress,
  splitAddress,
  mutlisigMooneyBalance,
  multisigNativeBalance,
  splitMooneyBalance,
  splitNativeBalance,
}: TeamTreasuryProps) {
  const address = useAddress()
  const sdk = useSDK()

  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      <div className="flex flex-col">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center pr-12">
          <div className="flex gap-5 opacity-[50%]">
            <Image
              src={'/assets/icon-treasury.svg'}
              alt="Treasury icon"
              width={30}
              height={30}
            />
            <h2 className="header font-GoodTimes">Treasury</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <StandardButton
              className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
              onClick={() => {
                const safeNetwork =
                  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
                window.open(
                  `https://app.safe.global/home?safe=${safeNetwork}:${multisigAddress}`
                )
              }}
            >
              {'Treasury'}
            </StandardButton>
            <StandardButton
              className="min-w-[200px] gradient-2 rounded-[5vmax]"
              onClick={async () => {
                if (!address) return toast.error('Please connect your wallet')
                if (!splitAddress) return toast.error('No split address found')
                console.log(splitAddress)
                if (
                  selectedChain.chainId !==
                  +wallets[selectedWallet]?.chainId.split(':')[1]
                ) {
                  wallets[selectedWallet]?.switchChain(selectedChain.chainId)
                  return toast.error(`Please switch to ${selectedChain.name}`)
                }

                try {
                  const splitContract = await sdk?.getContract(
                    splitAddress,
                    TeamSplitABI
                  )
                  const tx = await splitContract?.call('release', [
                    multisigAddress,
                  ])

                  if (tx.receipt) {
                    toast.success('Funds Released')
                  }
                } catch (err: any) {
                  if (
                    err.reason.startsWith(
                      'PaymentSplitter: account is not due payment'
                    )
                  ) {
                    toast.error('No funds to release')
                  }
                }
              }}
            >
              {'Release to Treasury'}
            </StandardButton>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          {multisigAddress ? (
            <button
              className="text-2xl flex pl-5 items-center gap-2 text-light-warm font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
              onClick={() => {
                navigator.clipboard.writeText(multisigAddress)
                toast.success('Address copied to clipboard')
              }}
            >
              {multisigAddress?.slice(0, 6) +
                '...' +
                multisigAddress?.slice(-4)}
              <CopyIcon />
            </button>
          ) : (
            <div className="mt-4 w-[200px] h-[50px] bg-[#ffffff25] animate-pulse" />
          )}
        </div>
        <div className="p-4">
          <div className="mt-4 flex gap-4 items-center text-lg">
            <p>{`MOONEY :`}</p>
            <p>
              {mutlisigMooneyBalance
                ? (
                    mutlisigMooneyBalance?.toString() /
                    10 ** 18
                  ).toLocaleString()
                : 0}
            </p>
          </div>
          <div className="flex gap-4 items-center text-lg">
            <p>{`ETHER :`}</p>
            <p className="pl-6">
              {multisigNativeBalance ? multisigNativeBalance : 0}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex gap-5 opacity-[50%]">
            <Image
              src={'/assets/icon-contract.svg'}
              alt="Treasury icon"
              width={30}
              height={30}
            />
            <h2 className="text-[150%] font-GoodTimes">Pending Disbursement</h2>
          </div>
          <div className="p-4">
            <div className="mt-4 flex gap-4 items-center text-lg">
              <p>{`MOONEY :`}</p>
              <p>
                {splitMooneyBalance
                  ? (splitMooneyBalance?.toString() / 10 ** 18).toLocaleString()
                  : 0}
              </p>
            </div>
            <div className="flex gap-4 items-center text-lg">
              <p>{`ETHER :`}</p>
              <p className="pl-6">
                {splitNativeBalance ? splitNativeBalance : 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
