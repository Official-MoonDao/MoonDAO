import { useContext, useEffect } from 'react'
import { mumbai } from 'thirdweb/chains'
import { ethereum, polygon } from '@/lib/infura/infuraChains'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import Head from '../../components/layout/Head'
import { SweepstakesMinting } from '../../components/ticket-to-space/SweepstakesMinting'
import SweepstakesHighlights from '@/components/ticket-to-space/SweepstakesHighlights'
import ERC20 from '../../const/abis/ERC20.json'
import ttsSweepstakesV2 from '../../const/abis/ttsSweepstakesV2.json'
import { MOONEY_ADDRESSES, TICKET_TO_SPACE_ADDRESS } from '../../const/config'

export default function Sweepstakes() {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContextV5)

  const ttsContract = useContract({
    chain: selectedChain,
    address: TICKET_TO_SPACE_ADDRESS,
    abi: ttsSweepstakesV2.abi,
  })

  const mooneyContract = useContract({
    chain: polygon,
    address: MOONEY_ADDRESSES['polygon'],
    abi: ERC20,
  })

  const mooneyETHContract = useContract({
    chain: ethereum,
    address: MOONEY_ADDRESSES['ethereum'], // testnet
    abi: ERC20,
  })

  const { data: supply } = useRead({
    contract: ttsContract,
    method: 'getSupply',
    params: [],
  })

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? polygon : mumbai
    )
  }, [setSelectedChain])

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
