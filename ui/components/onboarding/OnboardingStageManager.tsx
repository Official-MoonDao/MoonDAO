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
import { InvolvementOptions } from './InvolvementOptions'

const isDevEnv = process.env.NODE_ENV === 'development'

function StageContainer({ children }: any) {
  return (
    <section className="py-8 w-[336px] sm:w-[400px] lg:w-full font-RobotoMono">
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
      <>
        {/*This div is the currently hidden progress bar */}
        <div className="hidden">
          <ul
            data-te-stepper-init
            className="relative  m-0 flex list-none justify-between overflow-hidden p-0 transition-[height] duration-200 ease-in-out"
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
        </div>
        {/*Main section*/}
        <main>{steps[stage].component}</main>
        {/*Previous / Next menu*/}
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
      </>
    )
  }

  const StepZero = () => (
    <StageContainer>
      <div className="flex flex-col items-center lg:items-start px-4 lg:px-7 xl:px-9 lg:max-w-[1080px]">
        <h2 className="text-[#071732] dark:text-white font-acme text-5xl sm:text-6xl lg:text-5xl xl:text-6xl text-center lg:text-left">
          Welcome to MoonDAO
        </h2>
        <p className="mt-5 lg:mt-4 xl:mt-6 text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 opacity-60 max-w-[698px] text-center lg:text-left">{`MoonDAO is accelerating humanity’s development of a lunar base through better coordination. Want to help? This flow will onboard you into our in less than 5 minutes, even if you’re new to Web3.
`}</p>

        <img
          src="demovideothumbnail.png"
          alt=""
          className="mt-10 lg:mt-4 xl:mt-6 w-full xl:w-5/6 aspect-video object-cover"
        />

        <button
          onClick={() => {
            if (!user) {
              login()
            } else {
              setStage(1)
            }
          }}
          className="mt-8 px-5 py-3 bg-moon-orange text-white hover:scale-105 transition-all duration-150 hover:bg-white hover:text-moon-orange"
        >
          Join MoonDAO
        </button>
      </div>
    </StageContainer>
  )

  const StepOne = () => (
    <StageContainer>
      <div className="flex flex-col font-RobotoMono items-center">
        <h1 className="text-[#071732] dark:text-white font-acme text-5xl lg:text-5xl xl:text-6xl text-center">
          SELECT MEMBERSHIP LEVEL
        </h1>

        <p className="mt-5 max-w-xs lg:max-w-sm xl:max-w-lg bg-[#D7594F36] px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] text-center xl:text-left text-sm xl:text-base">
          You must be a member to participate in our space ticket giveaway.
          <br />
          <br className="2xl:hidden" />
          Entries into the Ticket To Space Sweepstakes are 20,000 $MOONEY each.
          🚀
        </p>
        <ContributionLevels
          selectedLevel={selectedLevel}
          setSelectedLevel={setSelectedLevel}
        />
        <ContributionModal
          selectedLevel={selectedLevel}
          setSelectedLevel={setSelectedLevel}
        />
      </div>
    </StageContainer>
  )

  {
    /* Checkout Transaction steps */
  }
  const Step = ({ stepNum, title, explanation }: any) => {
    return (
      <div className="mt-5">
        <div className="flex flex-col items-center text-center lg:flex-row lg:text-left lg:gap-5 lg:w-full p-2 lg:p-3 border border-white border-opacity-[0.18]">
          <p className="block bg-moon-orange px-3 py-1 text-xl font-bold rounded-[9999px]">
            {stepNum}
          </p>
          <p className="mt-[15px] block lg:mt-0 xl:text-xl lg:max-w-[190px]">
            {title}
          </p>
          <p className="mt-1 opacity-60 block lg:mt-0 text-sm xl:text-base">
            {explanation}
          </p>
        </div>
      </div>
    )
  }

  const StepTwo = () => (
    <StageContainer>
      <div className="flex flex-col items-center lg:items-start px-4 lg:px-7 xl:px-9 lg:max-w-[1080px]">
        <h1 className="font-acme text-[#071732] dark:text-white text-5xl sm:text-6xl lg:text-5xl xl:text-6xl text-center lg:text-left">
          Check out
        </h1>
        {/*Steps*/}
        <div className="mt-2 lg:mt-5">
          <Step
            stepNum={1}
            title={'Purchase ETH'}
            explanation={
              'You need ETH to swap it for our governance token MOONEY.'
            }
          />
          <Step
            stepNum={2}
            title={'Purchase MOONEY on Uniswap'}
            explanation={
              'MoonDAO routes the order to the best price on a Decentralized Exchange using the low gas fees provided by Polygon.'
            }
          />
          <Step
            stepNum={3}
            title={'Token Approval'}
            explanation={
              'Next, you’ll approve some of the MOONEY tokens for staking. This prepares your tokens for the next step.'
            }
          />
          <Step
            stepNum={4}
            title={'Stake MOONEY'}
            explanation={
              'Last step, staking tokens gives you voting power within the community and makes you a full member of our community!'
            }
          />
        </div>
      </div>
    </StageContainer>
  )

  const StepThree = () => (
    <StageContainer>
      <OnboardingCongrats />
    </StageContainer>
  )

  const StepFour = () => (
    <StageContainer>
      <div className="relative flex flex-col items-center lg:items-start px-4 lg:px-7 xl:px-9 lg:max-w-[1080px]">
        <h1 className="font-GoodTimes text-[#071732] dark:text-white text-4xl sm:text-5xl text-center lg:text-left">
          Next Steps
        </h1>
        <p className="mt-5 lg:mt-4 xl:mt-6 text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left">{`Step 1: Tell your friends about MoonDAO. Top referrals get extra bonuses, like extra entries into our Sweepstakes with Blue Origin!`}</p>

        <button className="mt-8 px-6 py-3 lg:px-8 xl:px-10 2xl:px-14 2xl:py-4 bg-moon-orange text-white hover:scale-105 transition-all duration-150 hover:bg-white hover:text-moon-orange">Share referral</button>
        <p className='mt-12 xl:mt-14 text-sm sm:text-base lg:text-sm xl:text-base max-w-[698px] text-center lg:text-left'>Step 2: Choose how you want to be involved.</p>

        <InvolvementOptions />
        {/*Ticket submission button*/}
        <button className='mt-10 rounded-[20px] py-3 px-4 font-bold lg:absolute bg-white hover:scale-105 hover:text-moon-orange transition-all duration-105 text-black lg:-bottom-24 lg:left-6 2xl:left-auto 2xl:right-10 text-xl'>Questions? Submit a ticket</button>
      </div>
    </StageContainer>
  )

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
    <div className="flex flex-col pt-10 w-full h-full">
      <MultiStepStage steps={steps} />
    </div>
  )
}
