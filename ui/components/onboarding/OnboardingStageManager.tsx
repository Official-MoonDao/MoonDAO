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
        <div className='w-100% h-100%'>
          <ol className="flex items-center w-full">
            <li className="flex w-full items-center text-blue-600 dark:text-blue-500 after:content-[''] after:w-full after:h-1 after:border-b after:border-blue-100 after:border-4 after:inline-block dark:after:border-blue-800">
              <span className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full lg:h-12 lg:w-12 dark:bg-blue-800 shrink-0">
                <svg className="w-3.5 h-3.5 text-blue-600 lg:w-4 lg:h-4 dark:text-blue-300" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5.917 5.724 10.5 15 1.5" />
                </svg>
              </span>
            </li>
            <li className="flex w-full items-center after:content-[''] after:w-full after:h-1 after:border-b after:border-gray-100 after:border-4 after:inline-block dark:after:border-gray-700">
              <span className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full lg:h-12 lg:w-12 dark:bg-gray-700 shrink-0">
                <svg className="w-4 h-4 text-gray-500 lg:w-5 lg:h-5 dark:text-gray-100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 16">
                  <path d="M18 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2ZM6.5 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3.014 13.021l.157-.625A3.427 3.427 0 0 1 6.5 9.571a3.426 3.426 0 0 1 3.322 2.805l.159.622-6.967.023ZM16 12h-3a1 1 0 0 1 0-2h3a1 1 0 0 1 0 2Zm0-3h-3a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2Zm0-3h-3a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2Z" />
                </svg>
              </span>
            </li>
            <li className="flex items-center w-full">
              <span className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full lg:h-12 lg:w-12 dark:bg-gray-700 shrink-0">
                <svg className="w-4 h-4 text-gray-500 lg:w-5 lg:h-5 dark:text-gray-100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 20">
                  <path d="M16 1h-3.278A1.992 1.992 0 0 0 11 0H7a1.993 1.993 0 0 0-1.722 1H2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2ZM7 2h4v3H7V2Zm5.7 8.289-3.975 3.857a1 1 0 0 1-1.393 0L5.3 12.182a1.002 1.002 0 1 1 1.4-1.436l1.328 1.289 3.28-3.181a1 1 0 1 1 1.392 1.435Z" />
                </svg>
              </span>
            </li>
          </ol>
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
