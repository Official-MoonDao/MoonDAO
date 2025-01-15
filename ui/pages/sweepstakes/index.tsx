import { Polygon, Mumbai } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '../../lib/thirdweb/chain-context'
import Head from '../../components/layout/Head'
import { SweepstakesMinting } from '../../components/ticket-to-space/SweepstakesMinting'
import SweepstakesHighlights from '@/components/ticket-to-space/SweepstakesHighlights'
import ERC20 from '../../const/abis/ERC20.json'
import ttsSweepstakesV2 from '../../const/abis/ttsSweepstakesV2.json'
import { MOONEY_ADDRESSES, TICKET_TO_SPACE_ADDRESS } from '../../const/config'

export default function Sweepstakes() {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  const [supply, setSupply] = useState(0)

  const { contract: ttsContract } = useContract(
    TICKET_TO_SPACE_ADDRESS,
    ttsSweepstakesV2.abi
  )

  const { contract: mooneyContract } = useContract(
    '0x74Ac7664ABb1C8fa152D41bb60e311a663a41C7E',
    ERC20
  ) //polygon mooney

  const { contract: mooneyETHContract } = useContract(
    MOONEY_ADDRESSES['ethereum'], // testnet
    ERC20
  ) //eth mooney\

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai
    )
  }, [setSelectedChain])

  useEffect(() => {
    if (ttsContract) {
      ttsContract
        .call('getSupply')
        .then((supply: any) => setSupply(supply.toString()))
        .catch((err: any) => console.log(err))
    }
  }, [ttsContract])
  return (
    <main className="animate-fadeIn">
      <Head
        title="Ticket to Space"
        image="https://gray-main-toad-36.mypinata.cloud/ipfs/QmdTYGGb5ayHor23WeCsNeT61Qzj8JK9EQmxKWeuGTQhYq"
      />
      <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 page-border-and-color font-RobotoMono w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white">
        <h1 className={`page-title flex text-lg`}>Ticket to Space</h1>
        <SweepstakesHighlights />
        <SweepstakesMinting
          setSelectedChain={setSelectedChain}
          selectedChain={selectedChain}
          ttsContract={ttsContract}
          supply={supply}
          mooneyContract={mooneyContract}
          mooneyETHContract={mooneyETHContract}
        />
      </div>
    </main>
  )
}
