/*
Onboarding Stages:
0. Welcome to MoonDAO
1. Select Contribution Level
2. Congrats
3. Proof of Humanity
*/
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useContract } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import { useContext, useEffect, useState, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useSwapRouter } from '../../lib/uniswap/hooks/useSwapRouter'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { ContributionLevels } from './ContributionLevels'
import ContributionModal from './ContributionModal'
import { OnboardingCongrats } from './OnboardingCongrats'
import { ProofOfHumanity } from './ProofOfHumanity'

const isDevEnv = process.env.NODE_ENV === 'development'

function StageContainer({ children }: any) {
  return (
    <section className="px-4 lg:px-7 xl:px-9 py-8 lg:py-10 lg:mt-5 w-[336px] sm:w-[400px] lg:w-full lg:max-w-[1080px] font-RobotoMono">
      {children}
    </section>
  )
}

export function OnboardingStageManager() {
  const { user, login } = usePrivy()
  const [stage, setStage] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const [selectedLevel, setSelectedLevel] = useState<number>(0)

  useEffect(() => {
    if (user && stage === 0) {
      setStage(1)
    } else if (!user) {
      setStage(0)
    }
  }, [user])

  const MultiStepStage = ({ steps }: any) => {
    const handleNext = () => {
      setStage(stage + 1)
    }

    const handlePrev = () => {
      setStage(stage - 1)
    }

    const progressWidth = useMemo(() => {
      if (stage === 0 || stage === 1 || !trackRef.current) return '0'
      if (stage === 4) return trackRef.current?.offsetWidth

      const stageWidth = trackRef.current?.offsetWidth / 2
      const width = stageWidth * (stage - 1)

      return width
    }, [trackRef.current, stage])

    return (
      <div>
        <ul
          data-te-stepper-init
          className="relative m-0 flex list-none justify-between overflow-hidden p-0 transition-[height] duration-200 ease-in-out"
          style={{ zIndex: 1 }}
        >
          <StepCircle stepNumber="1" currentStage={stage} />
          <StepCircle stepNumber="2" currentStage={stage} />
          <StepCircle stepNumber="3" currentStage={stage} />
        </ul>
        <div className="mb-8">
          <div className="bg-light relative h-[10px] w-full rounded-2xl bottom-12">
            <div
              ref={trackRef}
              className="bg-gray-500 max-w-[1112px] absolute top-0 left-0 h-full w-[100%] rounded-2xl"
            ></div>
            <div
              className={`bg-success absolute top-0 left-0 h-full rounded-2xl`}
              style={{ width: `${progressWidth}px` }}
            ></div>
          </div>
        </div>
        <br />
        <div>
          <br />
          {steps[stage].component}
        </div>
        <br />
        {isDevEnv && stage > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'start' }}>
              <button onClick={handlePrev} disabled={stage === 0}>
                Previous
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'end' }}>
              <button
                onClick={handleNext}
                disabled={stage === steps.length - 1}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const StepZero = () => (
    <StageContainer>
      <h2 className="text-[#071732] dark:text-white font-GoodTimes text-4xl lg:text-5xl text-left">
        Welcome to MoonDAO
      </h2>
      <p className="mt-[15px] text-base opacity-60">{`Onboarding at MoonDAO takes less than five minutes even if it's your first time in Web3.`}</p>

      <div className="mt-10 bg-slate-950 animate-pulse  w-[320px] sm:w-[80%] h-[426px]"></div>

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
    </StageContainer>
  )

  const StepOne = () => (
    <StageContainer>
      <h1 className="text-[#071732] dark:text-white font-GoodTimes text-3xl sm:text-4xl lg:text-5xl text-left">
        Step 1 of 3: Select Contribution Level
      </h1>
      <ContributionLevels
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
      />
      <ContributionModal
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
      />
    </StageContainer>
  )

  const StepTwo = () => (
    <StageContainer>
      <OnboardingCongrats />
    </StageContainer>
  )

  const StepThree = () => (
    <StageContainer>
      <h1 className="text-[#071732] dark:text-white font-GoodTimes text-4xl lg:text-5xl text-left">
        Proof of Humanity
      </h1>
      <p className="mt-[15px] text-base opacity-60">{`To access governance and events at MoonDAO you must complete thtese steps.  No identifying data is stored by MoonDAO in this process.`}</p>
      <ProofOfHumanity />
    </StageContainer>
  )

  const StepFour = () => <StageContainer />

  const StepCircle = (props: any) => {
    const { stepNumber, currentStage } = props

    const isActive = currentStage > parseInt(stepNumber)
    return (
      <li>
        <div className="flex cursor-pointer items-center leading-[1.3rem] no-underline focus:outline-none">
          <span
            className={`my-6 flex h-[40px] w-[40px] items-center justify-center rounded-full ${
              isActive ? 'bg-[#16a34a]' : 'bg-[#ebedef]'
            } text-md font-medium ${
              isActive ? 'text-white' : 'text-[#40464f]'
            }`}
          >
            {stepNumber}
          </span>
        </div>
      </li>
    )
  }

  const steps = [
    { component: <StepZero /> },
    { component: <StepOne /> },
    { component: <StepTwo /> },
    { component: <StepThree /> },
    { component: <StepFour /> },
  ]

  return (
    <div className="flex flex-col pt-8 w-full h-full">
      <MultiStepStage steps={steps} />
    </div>
  )
}
