import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import useOnrampJWT from '@/lib/coinbase/useOnrampJWT'
import { useOnrampRedirect } from '@/lib/coinbase/useOnrampRedirect'
import { arbitrum } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import Frame from '@/components/layout/Frame'
import { CBOnrampModal } from '../coinbase/CBOnrampModal'
import Action from './Action'

export default function GuestActions({
  address,
  nativeBalance: nativeBalanceProp,
  citizenContract,
}: any) {
  const router = useRouter()
  const { selectedChain } = useContext(ChainContextV5) || { selectedChain: arbitrum }
  const { nativeBalance: nativeBalanceHook, refetch: refetchNativeBalance } = useNativeBalance()
  const nativeBalance = nativeBalanceProp || nativeBalanceHook
  const chainSlug = getChainSlug(selectedChain || arbitrum)

  const [canBuyCitizen, setCanBuyCitizen] = useState(false)
  const [onrampModalOpen, setOnrampModalOpen] = useState(false)
  const requiredEthAmount = 0.01125 // 0.01125

  // Redirect handling
  const { isReturningFromOnramp, clearRedirectParams } = useOnrampRedirect()
  const { verifyJWT, getStoredJWT, clearJWT } = useOnrampJWT()

  useEffect(() => {
    async function checkIfCanBuyCitizen() {
      const cost = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })

      const formattedCost = ethers.utils.formatEther(cost.toString()).toString()
      const estimatedMaxGas = 0.0001
      const totalCost = Number(formattedCost) + estimatedMaxGas

      if (+nativeBalance >= totalCost) {
        setCanBuyCitizen(true)
      } else {
        setCanBuyCitizen(false)
      }
    }

    if (address && citizenContract) checkIfCanBuyCitizen()
  }, [address, nativeBalance, citizenContract])

  // Handle redirect return - verify JWT and refresh balance check
  useEffect(() => {
    if (isReturningFromOnramp && address) {
      // Verify JWT before proceeding
      const storedJWT = getStoredJWT()
      if (!storedJWT) {
        // No JWT - clear redirect params
        clearRedirectParams()
        return
      }

      verifyJWT(storedJWT, address, undefined, 'guest').then((payload) => {
        if (
          !payload ||
          payload.address.toLowerCase() !== address.toLowerCase() ||
          payload.chainSlug !== chainSlug ||
          payload.context !== 'guest'
        ) {
          // Invalid JWT - clear and exit
          clearJWT()
          clearRedirectParams()
          return
        }

        // JWT valid - refresh balance
        clearRedirectParams()
        clearJWT() // Clear JWT after verification
        setTimeout(async () => {
          await refetchNativeBalance()
        }, 1000)
      })
    }
  }, [
    isReturningFromOnramp,
    address,
    clearRedirectParams,
    refetchNativeBalance,
    getStoredJWT,
    verifyJWT,
    clearJWT,
    chainSlug,
  ])

  return (
    <div id="guest-actions-container" className="py-5 md:px-5 md:py-0 z-30">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pr-12">
        <div className="flex gap-5 opacity-[50%]">
          <h2 className="header font-GoodTimes">Next Steps</h2>
        </div>
      </div>
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
              description="Create your profile and join the Space Acceleration Network to take the next step in your journey and join a global movement dedicated to humanity expanding beyond Earth."
              icon={
                <Image src="/assets/icon-job.svg" alt="Browse open jobs" height={30} width={30} />
              }
              onClick={() => router.push('/citizen')}
            />
          ) : (
            <Action
              title="Fund Wallet"
              description="Fund your wallet directly within the website in order to proceed with purchasing Citizenship to the Space Acceleration Network. You will need 0.01125 Arbitrum ETH (estimated gas cost included)."
              icon={
                <Image
                  src="/assets/icon-project.svg"
                  alt="Submit a proposal"
                  height={30}
                  width={30}
                />
              }
              onClick={() => {
                if (address) {
                  setOnrampModalOpen(true)
                }
              }}
            />
          )}
        </div>
      </Frame>
      {address && (
        <CBOnrampModal
          enabled={onrampModalOpen}
          setEnabled={setOnrampModalOpen}
          address={address}
          selectedChain={selectedChain || arbitrum}
          ethAmount={requiredEthAmount}
          context="guest"
        />
      )}
    </div>
  )
}
