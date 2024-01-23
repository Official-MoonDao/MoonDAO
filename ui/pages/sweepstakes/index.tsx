import { Polygon, Ethereum, Goerli, Mumbai } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '../../lib/thirdweb/chain-context'
import Head from '../../components/layout/Head'
import { SweepstakesMinting } from '../../components/ticket-to-space/SweepstakesMinting'
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
    ERC20.abi
  ) //polygon mooney

  const { contract: mooneyETHContract } = useContract(
    MOONEY_ADDRESSES['ethereum'], // testnet
    ERC20.abi
  ) //eth mooney\

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai
    )
  }, [])

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
      <SweepstakesMinting
        setSelectedChain={setSelectedChain}
        selectedChain={selectedChain}
        ttsContract={ttsContract}
        supply={supply}
        mooneyContract={mooneyContract}
        mooneyETHContract={mooneyETHContract}
      />
    </main>
  )
}
