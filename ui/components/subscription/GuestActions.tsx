import { useFundWallet } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import viemChains from '@/lib/viem/viemChains'
import Frame from '@/components/layout/Frame'
import Action from './Action'

export default function GuestActions({
  address,
  nativeBalance,
  citizenContract,
}: any) {
  const router = useRouter()

  const [canBuyCitizen, setCanBuyCitizen] = useState(false)

  const { fundWallet } = useFundWallet()

  useEffect(() => {
    async function checkIfCanBuyCitizen() {
      const cost = await citizenContract?.call('getRenewalPrice', [
        address,
        365 * 24 * 60 * 60,
      ])

      const formattedCost = ethers.utils.formatEther(cost.toString()).toString()
      const estimatedMaxGas = 0.0001
      const totalCost = Number(formattedCost) + estimatedMaxGas

      if (nativeBalance >= totalCost) {
        setCanBuyCitizen(true)
      } else {
        setCanBuyCitizen(false)
      }
    }

    if (address && citizenContract) checkIfCanBuyCitizen()
  }, [address, nativeBalance, citizenContract])

  return (
    <div id="team-actions-container" className="px-5 pt-5 md:px-0 md:pt-0">
      <Frame
        noPadding
        marginBottom="0px"
        bottomRight="2vmax"
        topRight="2vmax"
        topLeft="10px"
        bottomLeft="2vmax"
      >
        <div className="mt-2 mb-5 grid grid-cols-1 gap-4 h-full">
          {canBuyCitizen ? (
            <Action
              title="Become a Citizen"
              description="Create your profile and join the network."
              icon={
                <Image
                  src="/assets/icon-job.svg"
                  alt="Browse open jobs"
                  height={30}
                  width={30}
                />
              }
              onClick={() => router.push('/citizen')}
            />
          ) : (
            <Action
              title="Fund Wallet"
              description="Fund your wallet with Arbitrum ETH directly from the app."
              icon={
                <Image
                  src="/assets/icon-project.svg"
                  alt="Submit a proposal"
                  height={30}
                  width={30}
                />
              }
              onClick={() => {
                if (address)
                  fundWallet(address, {
                    chain: viemChains['arbitrum'],
                    asset: 'native-currency',
                  })
              }}
            />
          )}
        </div>
      </Frame>
    </div>
  )
}
