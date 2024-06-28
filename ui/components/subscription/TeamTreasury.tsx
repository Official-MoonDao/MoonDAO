import { useAddress, useSDK } from '@thirdweb-dev/react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import TeamSplitABI from '../../const/abis/TeamSplit.json'
import { CopyIcon } from '../assets'
import StandardButton from '../layout/StandardButton'

type TeamTreasuryProps = {
  multisigAddress: string
  splitAddress: string | undefined
  mutlisigMooneyBalance: any
  multisigNativeBalance: any
  splitMooneyBalance: any
  splitNativeBalance: any
}

export default function TeamTreasury({
  multisigAddress,
  splitAddress,
  mutlisigMooneyBalance,
  multisigNativeBalance,
  splitMooneyBalance,
  splitNativeBalance,
}: TeamTreasuryProps) {
  const address = useAddress()
  const sdk = useSDK()

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
          <div className="flex gap-2 items-end">
            <StandardButton
              className="w-full gradient-2 rounded-[5vmax] rounded-tr-[10px] rounded-br-[10px]"
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
              className="w-full gradient-2 rounded-[5vmax] rounded-tl-[10px] rounded-bl-[10px]"
              onClick={async () => {
                if (!address) return toast.error('Please connect your wallet')
                if (!splitAddress) return toast.error('No split address found')

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
                  console.log(err)
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
              className="text-2xl flex items-center gap-2 text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
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

        <div className="mt-4 flex gap-4 items-center text-lg">
          <p>{`MOONEY :`}</p>
          <p>
            {mutlisigMooneyBalance
              ? (mutlisigMooneyBalance?.toString() / 10 ** 18).toLocaleString()
              : 0}
          </p>
        </div>
        <div className="flex gap-4 items-center text-lg">
          <p>{`ETHER :`}</p>
          <p className="pl-6">
            {multisigNativeBalance ? multisigNativeBalance : 0}
          </p>
        </div>
        <div className="mt-4">
          <div className="flex gap-5 opacity-[50%]">
            <Image
              src={'/assets/icon-contract.svg'}
              alt="Treasury icon"
              width={30}
              height={30}
            />
            <h2 className="header font-GoodTimes">Pending Disbursement</h2>
          </div>
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
  )
}
