import { ArrowDownIcon } from '@heroicons/react/20/solid'
import { ArrowDownCircleIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

function PayRedeemStat({ label, value, children }: any) {
  return (
    <div className="font-GoodTimes w-1/3 flex flex-col">
      <h3 className="opacity-60 text-[60%]">{label}</h3>
      <p>{value}</p>
      {children}
    </div>
  )
}

export default function MissionPayRedeem({
  mission,
  token,
  paymentsCount,
  totalRaised,
  increaseThisWeek,
  jbDirectoryContract,
}: any) {
  const account = useActiveAccount()
  const address = account?.address
  const [input, setInput] = useState(0)
  const [output, setOutput] = useState(0)

  const [primaryTerminalContract, setPrimaryTerminalContract] = useState<any>()

  async function buyMissionToken() {
    if (!account) return

    const transaction = prepareContractCall({
      contract: primaryTerminalContract,
      method: 'pay' as string,
      params: [
        mission?.projectId,
        token?.tokenAddress,
        input,
        address,
        100,
        'Pay to Mission',
        '0x0',
      ],
    })

    const receipt = await sendAndConfirmTransaction({
      transaction,
      account,
    })
  }

  async function redeemMissionToken() {
    if (!account) return

    const transaction = prepareContractCall({
      contract: primaryTerminalContract,
      method: 'cashOutTokensOf' as string,
      params: [address, mission?.projectId, 0, 0, 0, address, '0x0'],
    })

    const receipt = await sendAndConfirmTransaction({
      transaction,
      account,
    })
  }

  useEffect(() => {
    async function getPrimaryTerminal() {
      const terminal = await readContract({
        contract: jbDirectoryContract,
        method: 'primaryTerminalOf' as string,
        params: [mission?.projectId, token?.tokenAddress],
      })
      setPrimaryTerminalContract(terminal)
    }
    getPrimaryTerminal()
  }, [mission?.projectId, token?.tokenAddress, jbDirectoryContract])

  return (
    <div className="p-2 max-w-[300px] flex flex-col gap-4 bg-[#020617] rounded-2xl">
      <div id="mission-pay-redeem-header" className="flex justify-between">
        <PayRedeemStat label="Payments" value={paymentsCount} />
        <PayRedeemStat label="Total Raised" value={totalRaised} />
        <PayRedeemStat label="Last 7 Days">
          <Image
            src="/assets/launchpad/increase.svg"
            alt="increase"
            width={30}
            height={30}
          />
        </PayRedeemStat>
      </div>
      {/* You pay */}
      <div className="relative flex flex-col gap-4">
        <div className="p-4 pb-12 flex items-center justify-between bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-tl-2xl rounded-tr-2xl">
          <div className="flex flex-col">
            <h3 className="text-sm opacity-60">You pay</h3>
            <input
              type="number"
              className="w-full bg-transparent border-none outline-none text-2xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={input}
              onChange={(e) => setInput(+e.target.value)}
              min={0}
            />
          </div>
          <div className="flex gap-2 items-center bg-[#111C42] rounded-full p-1">
            <Image
              src="/coins/ETH.svg"
              alt="ETH"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            {'ETH'}
          </div>
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex items-center justify-center">
          <ArrowDownIcon
            className="p-2 w-12 h-12 bg-darkest-cool rounded-full"
            color={'#121C42'}
          />
        </div>
        {/* You receive */}
        <div className="p-4 pb-12 flex items-center justify-between bg-gradient-to-r from-[#121C42] to-[#090D21] rounded-bl-2xl rounded-br-2xl">
          <div className="flex flex-col">
            <h3 className="text-sm opacity-60">You receive</h3>
            <p className="text-2xl font-bold">{output}</p>
          </div>
          <div className="relative flex gap-2 items-center bg-[#111C42] rounded-full p-1">
            <Image
              src="/assets/icon-star.svg"
              alt="ETH"
              width={20}
              height={20}
              className="bg-orange-500 rounded-full p-1w-5 h-5"
            />
            <Image
              src="/coins/ETH.svg"
              alt="ETH"
              width={20}
              height={20}
              className="absolute bottom-0 w-5 h-5"
            />
            {token?.tokenSymbol}
          </div>
        </div>
      </div>
      <PrivyWeb3Button className="rounded-full" label="Pay" action={() => {}} />
    </div>
  )
}
