import { ArrowUpRightIcon, PlusCircleIcon } from '@heroicons/react/24/outline'
import { useAddress, useSDK } from '@thirdweb-dev/react'
import toast from 'react-hot-toast'
import TeamSplitABI from '../../const/abis/TeamSplit.json'
import { CopyIcon } from '../assets'
import Button from './Button'
import Card from './Card'

type TeamTreasuryProps = {
  multisigAddress: string
  splitAddress: string
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
    <Card className="w-full flex flex-col md:flex-row justify-between items-start gap-4">
      <div className="w-3/4 flex flex-col">
        <div className="flex items-center gap-4">
          <p className="text-2xl">Treasury</p>
          {multisigAddress ? (
            <button
              className="flex items-center gap-2 text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg"
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
        <div>
          <p className="text-2xl mt-4">Pending Disbursement</p>
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

      <div className="flex flex-col xl:flex-row gap-2 items-end">
        <Button
          onClick={() => {
            const safeNetwork =
              process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
            window.open(
              `https://app.safe.global/home?safe=${safeNetwork}:${multisigAddress}`
            )
          }}
        >
          <ArrowUpRightIcon height={20} width={20} />
          {'Treasury'}
        </Button>
        <Button
          onClick={async () => {
            if (!address) return toast.error('Please connect your wallet')
            if (!splitAddress) return toast.error('No split address found')

            const splitContract = await sdk?.getContract(
              splitAddress,
              TeamSplitABI
            )
            const tx = await splitContract?.call('release', [multisigAddress])

            if (tx.receipt) {
              toast.success('Funds Released')
            }
          }}
        >
          <PlusCircleIcon height={20} width={20} />
          {'Release to Treasury'}
        </Button>
      </div>
    </Card>
  )
}
