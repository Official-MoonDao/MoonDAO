import { usePrivy } from '@privy-io/react-auth'
import { useAddress, useContract } from '@thirdweb-dev/react'
import { nativeOnChain } from '@uniswap/smart-order-router'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useTokenAllowance } from '../../lib/tokens/approve'
import { useTotalMooneyBalance } from '../../lib/tokens/hooks/useTotalMooneyBalance'
import { useValidVP } from '../../lib/tokens/hooks/useValidVP'
import { useMOONEYBalance } from '../../lib/tokens/mooney-token'
import { useVMOONEYLock } from '../../lib/tokens/ve-token'
import { useUniswapTokens } from '../../lib/uniswap/UniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import ERC20 from '../../const/abis/ERC20.json'
import VotingEscrow from '../../const/abis/VotingEscrow.json'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from '../../const/config'
import L2Toggle from '../lock/L2Toggle'
import { ContributionLevels } from './ContributionLevels'
import { InvolvementOptions } from './InvolvementOptions'
import { OnboardingCongrats } from './OnboardingCongrats'
import { OnboardingTransactions } from './OnboardingTransactions'

/*
Onboarding Stages:
0. Welcome to MoonDAO
1. Select Contribution Level
2. Congrats
3. Proof of Humanity
*/

const isDevEnv = process.env.NODE_ENV === 'development'

function StageContainer({ children }: any) {
  return (
    <section className="py-8 w-[336px] sm:w-[400px] lg:w-full font-RobotoMono">
      {children}
    </section>
  )
}

export function OnboardingStageManager({ selectedChain }: any) {
  const address = useAddress()
  const { user, login } = usePrivy()
  const [stage, setStage] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const [selectedLevel, setSelectedLevel] = useState<any>({
    price: 0,
    hasVotingPower: false,
    nativeSwapRoute: null,
  })

  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug],
    ERC20.abi
  )
  const { contract: vMooneyContract } = useContract(
    VMOONEY_ADDRESSES[selectedChain.slug],
    VotingEscrow.abi
  )

  const { data: vMooneyLock } = useVMOONEYLock(vMooneyContract, address)

  const { data: mooneyBalance } = useMOONEYBalance(mooneyContract, address)

  const totalMooneyBalance = useTotalMooneyBalance(address)
  const { totalLocked } = useValidVP(address)

  const { data: tokenAllowance } = useTokenAllowance(
    mooneyContract,
    address,
    VMOONEY_ADDRESSES[selectedChain.slug]
  )

  const { MOONEY, NATIVE_TOKEN } = useUniswapTokens()

  const { generateRoute: generateNativeRoute } = useUniversalRouter(
    selectedLevel.price,
    MOONEY,
    NATIVE_TOKEN
  )

  useEffect(() => {
    if (selectedLevel.price > 0) {
      setStage(2)
    }

    if (selectedLevel.price != 0) {
      generateNativeRoute().then((swapRoute: any) => {
        setSelectedLevel((prev: any) => ({
          ...prev,
          nativeSwapRoute: swapRoute,
        }))
      })
    }
  }, [selectedLevel.price, address, selectedChain])

  //skip tx stage if user already has a mooney lock greate than the selected level
  useEffect(() => {
    console.log(totalLocked, totalMooneyBalance)
    if (
      selectedLevel.price > 0 &&
      totalLocked >= 0 &&
      totalMooneyBalance >= 0
    ) {
      console.log(selectedLevel.hasVotingPower)
      if (selectedLevel.hasVotingPower) {
        if (selectedLevel.price / 2 <= totalLocked) {
          setStage(4)
        }
      } else {
        console.log(selectedLevel.price)
        if (selectedLevel.price <= totalMooneyBalance) {
          setStage(4)
        }
      }
    }
  }, [selectedLevel.price, totalLocked, totalMooneyBalance, selectedChain])

  useEffect(() => {
    if (stage > 1) {
      setStage(0)
    }
  }, [address])

  const MultiStepStage = ({ steps }: any) => {
    const handleNext = () => {
      setStage(stage + 1)
    }

    const handlePrev = () => {
      if (stage === 2) {
        setSelectedLevel({ price: 0, hasVotingPower: false })
      }
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
        <h2 className="text-[#071732] dark:text-white font-GoodTimes text-4xl sm:text-5xl lg:text-4xl xl:text-5xl text-center lg:text-left">
          Welcome to MoonDAO
        </h2>
        <p className="mt-5 lg:mt-4 xl:mt-6 text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-600 dark:text-white dark:opacity-60">{`MoonDAO is accelerating humanity’s development of a lunar base through better coordination. Want to help? This flow will onboard you into our in less than 5 minutes, even if you’re new to Web3.
`}</p>

        <iframe
          src="https://www.youtube.com/embed/Vs_vAtRgaBA"
          className="mt-10 lg:mt-4 xl:mt-6 w-full xl:w-5/6 aspect-video object-cover"
        />

        <button
          onClick={async () => {
            if (!user) {
              login()
              setStage(1)
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
        <h1 className="text-[#071732] dark:text-white font-GoodTimes text-4xl lg:text-5xl text-center">
          SELECT MEMBERSHIP LEVEL
        </h1>

        <p className="mt-5 max-w-xs lg:max-w-sm xl:max-w-lg bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] text-center xl:text-left text-sm xl:text-base">
          You must be a member to participate in our space ticket giveaway.
          <br />
          <br className="2xl:hidden" />
          Entries into the Ticket To Space Sweepstakes are 20,000 $MOONEY each.
          🚀
        </p>
        <div className="py-4">
          <L2Toggle />
        </div>
        <ContributionLevels
          selectedChain={selectedChain}
          selectedLevel={selectedLevel}
          setSelectedLevel={setSelectedLevel}
        />
      </div>
    </StageContainer>
  )

  {
    /* Checkout Transaction steps */
  }

  const StepTwo = () => (
    <StageContainer>
      <div className="flex flex-col items-center lg:items-start px-4 lg:px-7 xl:px-9 lg:max-w-[1080px]">
        <div className="flex w-full justify-between">
          <h1 className="font-GoodTimes text-[#071732] dark:text-white text-4xl sm:text-5xl lg:text-4xl xl:text-5xl text-center lg:text-left">
            Check out
          </h1>
          <button
            className="py-2 px-4 lg:py-3 lg:px-5 lg:self-start transition-all duration-105 hover:scale-105 inline-flex items-center space-x-3"
            style={{ marginBottom: '68px' }}
            onClick={() => {
              setStage(1)
              setSelectedLevel({ price: 0, hasVotingPower: false })
            }}
          >
            <input type="image" src="/backIcon.png" />
            <span>Back</span>
          </button>
        </div>
        <OnboardingTransactions
          setStage={setStage}
          setSelectedLevel={setSelectedLevel}
          selectedLevel={selectedLevel}
          selectedChain={selectedChain}
          mooneyBalance={mooneyBalance}
          vMooneyLock={vMooneyLock}
          tokenAllowance={tokenAllowance}
          approveMooney={async () =>
            mooneyContract &&
            (await mooneyContract.call('approve', [
              VMOONEY_ADDRESSES[selectedChain.slug],
              selectedLevel.price,
            ]))
          }
          createLock={async () =>
            vMooneyContract &&
            (await vMooneyContract.call('create_lock', [
              selectedLevel.price,
              Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 1,
            ]))
          }
        />
      </div>
    </StageContainer>
  )

  const StepThree = () => (
    <StageContainer>
      <OnboardingCongrats progress={() => setStage(stage + 1)} />
    </StageContainer>
  )

  const StepFour = () => (
    <StageContainer>
      <div className="relative flex flex-col items-center lg:items-start px-4 lg:px-7 xl:px-9 lg:max-w-[1080px]">
        <h1 className="font-GoodTimes text-[#071732] dark:text-white text-4xl sm:text-5xl text-center lg:text-left">
          Next Steps
        </h1>
        <p className="mt-5 lg:mt-4 xl:mt-6 text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-900 dark:text-gray-100">{`Step 1: Tell your friends about MoonDAO. Top referrals get extra bonuses, like extra entries into our Sweepstakes with Blue Origin!`}</p>

        <button className="mt-8 px-6 py-3 lg:px-8 xl:px-10 2xl:px-14 2xl:py-4 bg-moon-orange text-white hover:scale-105 transition-all duration-150 hover:bg-white hover:text-moon-orange">
          Share referral
        </button>
        <p className="mt-12 xl:mt-14 text-sm sm:text-base lg:text-sm xl:text-base max-w-[698px] text-center lg:text-left text-gray-900 dark:text-gray-100">
          Step 2: Choose how you want to be involved.
        </p>

        <InvolvementOptions />
        {/*Ticket submission button*/}
        <button
          onClick={() =>
            window.open(
              'https://circles.spect.network/r/8e96f155-c255-4567-bca3-8bec6a0b7867'
            )
          }
          className="mt-10 rounded-[20px] py-3 px-4 font-bold lg:absolute dark:bg-white bg-gray-800 text-gray-100 hover:scale-105 dark:text-gray-900 hover:text-moon-orange dark:hover:text-moon-orange transition-all duration-105 lg:-bottom-24 lg:left-6 2xl:left-auto 2xl:right-10 text-xl"
        >
          Questions? Submit a ticket
        </button>
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
