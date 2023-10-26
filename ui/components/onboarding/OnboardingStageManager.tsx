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
        <ul
          data-te-stepper-init
          className="relative m-0 flex list-none justify-between overflow-hidden p-0 transition-[height] duration-200 ease-in-out">

          <li
            data-te-stepper-step-ref
            data-te-stepper-step-active
            className="w-[4.5rem] flex-auto">
            <div
              data-te-stepper-head-ref
              className="flex cursor-pointer items-center pl-2 leading-[1.3rem] no-underline after:ml-2 after:h-px after:w-full after:flex-1 after:bg-[#e0e0e0] after:content-[''] hover:bg-[#f9f9f9] focus:outline-none dark:after:bg-neutral-600 dark:hover:bg-[#3b3b3b]">
              <span
                data-te-stepper-head-icon-ref
                className={`my-6 mr-2 flex h-[1.938rem] w-[1.938rem] items-center justify-center rounded-full ${stage >= 2 ? 'bg-[#16a34a]' : 'bg-[#ebedef]'} text-sm font-medium text-[#40464f]`}>
                1
              </span>
              {/* <span
                data-te-stepper-head-text-ref
                className="font-medium text-neutral-500 after:flex after:text-[0.8rem] after:content-[data-content] dark:text-neutral-300">
                Step 1
              </span> */}
            </div>
          </li>

          <li data-te-stepper-step-ref className="w-[4.5rem] flex-auto">
            <div
              data-te-stepper-head-ref
              className="flex cursor-pointer items-center leading-[1.3rem] no-underline before:mr-2 before:h-px before:w-full before:flex-1 before:bg-[#e0e0e0] before:content-[''] after:ml-2 after:h-px after:w-full after:flex-1 after:bg-[#e0e0e0] after:content-[''] hover:bg-[#f9f9f9] focus:outline-none dark:before:bg-neutral-600 dark:after:bg-neutral-600 dark:hover:bg-[#3b3b3b]">
              <span
                data-te-stepper-head-icon-ref
                className={`my-6 mr-2 flex h-[1.938rem] w-[1.938rem] items-center justify-center rounded-full ${stage >= 3 ? 'bg-[#16a34a]' : 'bg-[#ebedef]'} text-sm font-medium text-[#40464f]`}>
                2
              </span>
              {/* <span
                data-te-stepper-head-text-ref
                className="text-neutral-500 after:flex after:text-[0.8rem] after:content-[data-content] dark:text-neutral-300">
                Step 2
              </span> */}
            </div>
          </li>

          <li data-te-stepper-step-ref className="w-[4.5rem] flex-auto">
            <div
              data-te-stepper-head-ref
              className="flex cursor-pointer items-center pr-2 leading-[1.3rem] no-underline before:mr-2 before:h-px before:w-full before:flex-1 before:bg-[#e0e0e0] before:content-[''] hover:bg-[#f9f9f9] focus:outline-none dark:before:bg-neutral-600 dark:after:bg-neutral-600 dark:hover:bg-[#3b3b3b]">
              <span
                data-te-stepper-head-icon-ref
                className={`my-6 mr-2 flex h-[1.938rem] w-[1.938rem] items-center justify-center rounded-full ${stage >= 4 ? 'bg-[#16a34a]' : 'bg-[#ebedef]'} text-sm font-medium text-[#40464f]`}>
                3
              </span>
              {/* <span
                data-te-stepper-head-text-ref
                className="text-neutral-500 after:flex after:text-[0.8rem] after:content-[data-content] dark:text-neutral-300">
                Step 3
              </span> */}
            </div>
          </li>
        </ul>
        <div>
          <progress value={stage != 0 ? stage + 1 : 0} max={steps.length} style={{ width: '100%' }}></progress>
        </div>
        <br />
        <div>
          {steps[stage].component}
        </div>
        <br />
        {stage > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'start' }}>
              <button onClick={handlePrev} disabled={stage === 0}>Previous</button>
            </div><div style={{ display: 'flex', justifyContent: 'end' }}>
              <button onClick={handleNext} disabled={stage === steps.length - 1}>Next</button>
            </div>
          </>
        )}
      </div >
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

  const StepFour = () => <StageContainer />

  const steps = [
    { component: <StepZero /> },
    { component: <StepOne /> },
    { component: <StepTwo /> },
    { component: <StepThree /> },
    { component: <StepFour /> },
  ];

  return (
    <div className="flex flex-col pt-8 w-full h-full">
      <MultiStepStage steps={steps} />
    </div>
  )
}
