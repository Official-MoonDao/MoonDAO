import { Mumbai, Polygon } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useContext, useEffect } from 'react'
import toast from 'react-hot-toast'
import ChainContext from '../../lib/thirdweb/chain-context'
import Head from '../../components/layout/Head'
import { SweepstakesMinting } from '../../components/ticket-to-space/SweepstakesMinting'
import { SweepstakesWinners } from '../../components/ticket-to-space/SweepstakesWinners'
import ERC20 from '../../const/abis/ERC20.json'
import ttsSweepstakesV2 from '../../const/abis/ttsSweepstakesV2.json'
import { TICKET_TO_SPACE_ADDRESS } from '../../const/config'

const DEV_TTS_ADDRESS = '0x5283b6035cfa7bb884b7f6a146fa6824ec9773c7'

export default function Sweepstakes() {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  const { contract: ttsContract } = useContract(
    TICKET_TO_SPACE_ADDRESS,
    ttsSweepstakesV2.abi
  )

  const { contract: mooneyContract } = useContract(
    '0x74Ac7664ABb1C8fa152D41bb60e311a663a41C7E',
    ERC20.abi
  )

  useEffect(() => {
    setSelectedChain(Polygon)
  }, [])

  return (
    <main className="animate-fadeIn">
      <Head title="Ticket to Space" />
      <SweepstakesMinting
        mooneyContract={mooneyContract}
        ttsContract={ttsContract}
      />
      {/* <SweepstakesWinners sweepstakesContract={ttsContract} /> */}
    </main>
  )
}
