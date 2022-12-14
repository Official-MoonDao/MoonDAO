import Image from 'next/image'
import { useEffect, useState } from 'react'
import { getSubgraph } from '../lib/analytics'
import { useMOONEYBalance } from '../lib/mooney-token'
import { useAccount } from '../lib/use-wagmi'
import { WrappedScene } from '../r3f/Wrapped/WrappedScene'

function Title({ text, flag }: any) {
  return (
    <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
      {text}
      {flag && <Image src={'/original.png'} width={36} height={36} />}
    </h1>
  )
}

export default function Wrapped(props: any) {
  const [userData, setUserData]: any = useState({})
  //   const { data: account } = useAccount()
  const address: any = '0x679d87d8640e66778c3419d164998e720d7495f6'
  const { data: balance } = useMOONEYBalance(address)
  useEffect(() => {
    if (props.holders && address && balance) {
      const vMooneyData = props.holders.find((h: any) => h.address === address)
      setUserData({
        ...vMooneyData,
        unlockedMooney: balance.formatted,
      })
    }
    console.log(userData)
  }, [balance, address])

  return (
    <div className="animate-fadeIn">
      <WrappedScene />
    </div>
  )
}

export async function getStaticProps() {
  const holders = await getSubgraph()

  return {
    props: {
      holders,
    },
    revalidate: 60,
  }
}
