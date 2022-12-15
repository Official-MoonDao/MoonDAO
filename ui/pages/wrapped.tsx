import { useEffect, useState } from 'react'
import { getSnapshot, getSubgraph } from '../lib/analytics'
import { useMOONEYBalance } from '../lib/mooney-token'
import { useAccount } from '../lib/use-wagmi'
import { WrappedScene } from '../r3f/Wrapped/WrappedScene'

export default function Wrapped(props: any) {
  const [userData, setUserData]: any = useState({})
  const { data: account } = useAccount()
  const walletAddress: any = account?.address
  const { data: balance } = useMOONEYBalance(walletAddress)
  let votes
  useEffect(() => {
    if (props.holders && account?.address && balance) {
      ;(async () => {
        const vMooneyData = (await props.holders.find(
          ({ address }: any) => address === account.address
        )) || { address: account.address, totalVMooney: '0' }
        votes = await getSnapshot(account.address)
        setUserData({
          ...vMooneyData,
          unlockedMooney: balance.formatted,
          votes,
        })
      })()
    }
  }, [props.holders, account, balance])
  return (
    <div className="animate-fadeIn">
      <WrappedScene userData={userData} />
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
