import { useEffect, useState } from 'react'
import { getSnapshot, getSubgraph } from '../lib/analytics'
import { useMOONEYBalance } from '../lib/mooney-token'
import { useAccount } from '../lib/use-wagmi'
import { WrappedScene } from '../r3f/Wrapped/WrappedScene'

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
        votes: props.snapshot,
      })
    }
  }, [balance, address])
  return (
    <div className="animate-fadeIn">
      <WrappedScene userData={userData} />
    </div>
  )
}

export async function getStaticProps() {
  const holders = await getSubgraph()
  const snapshot = await getSnapshot()
  return {
    props: {
      holders,
      snapshot,
    },
    revalidate: 60,
  }
}
