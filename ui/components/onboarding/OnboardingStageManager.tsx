/*
Onboarding Stages:
0. Welcome to MoonDAO
1. Select Contribution Level
2. Proof of Humanity
*/
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useContract } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { ContributionLevels } from './ContributionLevels'

function StageContainer({ children }: any) {
  return <div className="flex flex-col gap-4 justify-center">{children}</div>
}

export function OnboardingStageManager() {
  const { user, login } = usePrivy()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const [stage, setStage] = useState(0)
  const [selectedLevel, setSelectedLevel] = useState<number>(0)
  const { wallets } = useWallets()

  const fund = useMoonPay()

  const { contract: maticContract } = useContract(
    '0x0000000000000000000000000000000000001010'
  )

  useEffect(() => {
    if (user && stage === 0) {
      setStage(1)
    } else if (!user) {
      setStage(0)
    }
  }, [user])

  return (
    <div className="flex pt-8 w-full h-full">
      {stage === 0 && (
        <StageContainer>
          <h1 className="text-2xl">WELCOME TO MOONDAO</h1>
          <p>{`Onboarding at MoonDAO takes less than five minutes even if it's your first time in Web3.`}</p>
          <button
            onClick={() => {
              if (!user) {
                login()
              } else {
                setStage(1)
              }
            }}
            className="px-4 py-2 bg-white text-black"
          >
            Begin Onboarding
          </button>
        </StageContainer>
      )}
      {stage === 1 && (
        <StageContainer>
          <h1 className="text-2xl">Step 1 of 3: Select Contribution Level</h1>
          <ContributionLevels
            selectedLevel={selectedLevel}
            setSelectedLevel={setSelectedLevel}
          />
          <PrivyWeb3Button
            label="Purchase"
            action={async () => {
              //check balance of wallet, if not enough matic then fund from moonpay
              console.log(wallets[selectedWallet])
              const maticBalance = await maticContract?.call('balanceOf', [
                wallets[selectedWallet].address,
              ])
              const formattedMaticBalance =
                ethers.utils.formatEther(maticBalance)

              if (+formattedMaticBalance < selectedLevel) {
                toast(
                  "You don't have enough Matic to purchase this level, use Moonpay to fund your wallet"
                )
                setTimeout(async () => {
                  await fund(selectedLevel - +formattedMaticBalance)
                }, 3000)
              }
              //buy mooney on L2 using uniswap

              //approve mooney for lock
              //lock mooney
            }}
            isDisabled={selectedLevel === 0}
          />
        </StageContainer>
      )}
      {stage === 2 && <StageContainer></StageContainer>}
    </div>
  )
}
