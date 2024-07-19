import { useAddress } from '@thirdweb-dev/react'
import request, { gql } from 'graphql-request'
import { useEffect, useState } from 'react'

export default function useTotalVP(address: string = '') {
  const [walletVP, setWalletVP] = useState<any>()

  useEffect(() => {
    async function getTotalVP() {
      const query = gql`
        {
          vp (voter: "${address}", space: "tomoondao.eth") {
            vp
          }
        }`
      const { vp } = (await request(
        `https://hub.snapshot.org/graphql`,
        query
      )) as any
      setWalletVP(vp.vp)
    }
    getTotalVP()
  }, [address])

  return walletVP
}
