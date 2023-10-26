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
import { useSwapRouter } from '../../lib/uniswap/hooks/useSwapRouter'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { ContributionLevels } from './ContributionLevels'
import { ProofOfHumanity } from './ProofOfHumanity'
import { OnboardingCongrats } from './OnboardingCongrats'

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

  const { generateRoute, executeRoute } = useSwapRouter(selectedLevel)

  useEffect(() => {
    if (user && stage === 0) {
      setStage(1)
    } else if (!user) {
      setStage(0)
    }
  }, [user])

  const MultiStepStage = ({ steps }: any) => {
    const handleNext = () => {
      setStage(stage + 1);
    }

    const handlePrev = () => {
      setStage(stage - 1);
    }

    return (
      <div>
        <div>
          <button onClick={handlePrev} disabled={stage === 0}>Previous</button>
          <br />
          <button onClick={handleNext} disabled={stage === steps.length - 1}>Next</button>
        </div>
        <div>
          <progress value={stage + 1} max={steps.length}></progress>
        </div>
        <div>
          {steps[stage].component}
        </div>
      </div>
    );
  };

  const StepZero = () => <StageContainer>
    <h2 className="text-[#071732] dark:text-white font-GoodTimes text-4xl lg:text-5xl text-left">Welcome to MoonDAO</h2>
    <p className='mt-[15px] text-base opacity-60'>{`Onboarding at MoonDAO takes less than five minutes even if it's your first time in Web3.`}</p>

    <div className='mt-10 bg-slate-950 animate-pulse  w-[320px] sm:w-[80%] h-[426px]'></div>


    <button
      onClick={() => {
        if (!user) {
          login()
        } else {
          setStage(1)
        }
      }}
      className="mt-6 px-5 py-3 bg-moon-orange"
    >
      Begin Onboarding
    </button>
  </StageContainer>;

  const StepOne = () => <StageContainer>
    <h1 className="text-[#071732] dark:text-white font-GoodTimes text-3xl sm:text-4xl lg:text-5xl text-left">Step 1 of 3: Select Contribution Level</h1>
    <ContributionLevels
      selectedLevel={selectedLevel}
      setSelectedLevel={setSelectedLevel}
    />
    {/*Hidden it for demo because it's not on the design, how should this one be added? */}
    <PrivyWeb3Button
      className='hidden'
      label="Purchase"
      action={async () => {
        //check balance of wallet, if not enough matic then fund from moonpay
        // const maticBalance = await maticContract?.call('balanceOf', [
        //   wallets[selectedWallet].address,
        // ])
        const provider = await wallets[selectedWallet].getEthersProvider()
        const nativeBalance = await provider.getBalance(
          wallets[selectedWallet].address
        )

        const formattedNativeBalance =
          ethers.utils.formatEther(nativeBalance)

        if (+formattedNativeBalance < selectedLevel) {
          toast(
            "You don't have enough Matic to purchase this level, use Moonpay to fund your wallet"
          )
          setTimeout(async () => {
            await fund(selectedLevel - +formattedNativeBalance)
          }, 3000)
        }

        //buy mooney on L2 using uniswap
        const route = await generateRoute()
        const tx = await executeRoute(route)
        //approve mooney for lock
        //lock mooney
      }}
      isDisabled={selectedLevel === 0}
    />
  </StageContainer>;

  const StepTwo = () => <StageContainer>
    <OnboardingCongrats />
  </StageContainer>;

  const StepThree = () => <StageContainer>
    <h1 className="text-[#071732] dark:text-white font-GoodTimes text-4xl lg:text-5xl text-left">Proof of Humanity</h1>
    <p className='mt-[15px] text-base opacity-60'>{`To access governance and events at MoonDAO you must complete thtese steps.  No identifying data is stored by MoonDAO in this process.`}</p>
    <ProofOfHumanity />
  </StageContainer>;

  const steps = [
    { component: <StepZero /> },
    { component: <StepOne /> },
    { component: <StepTwo /> },
    { component: <StepThree /> },
  ];

  return (
    <div className="flex flex-col pt-8 w-full h-full">
      <MultiStepStage steps={steps} />
    </div>
  )
}
