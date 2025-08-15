import { usePrivy } from '@privy-io/react-auth'
import { TradeType } from '@uniswap/sdk-core'
import { nativeOnChain } from '@uniswap/smart-order-router'
import Link from 'next/link'
import { useEffect, useState, useRef, useMemo, useContext } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useTotalMooneyBalance } from '../../lib/tokens/hooks/useTotalMooneyBalance'
import { useUniswapTokens } from '../../lib/uniswap/hooks/useUniswapTokens'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVP } from '@/lib/tokens/hooks/useTotalVP'
import NetworkSelector from '../../components/thirdweb/NetworkSelector'
import ERC20 from '../../const/abis/ERC20.json'
import VotingEscrow from '../../const/abis/VotingEscrow.json'
import { MOONEY_ADDRESSES, VMOONEY_ADDRESSES } from '../../const/config'
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
  return <section className="w-full font-Roboto">{children}</section>
}

export function OnboardingStageManager({ usdQuotes }: any) {
  const account = useActiveAccount()
  const address = account?.address
  const { user } = usePrivy()
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [stage, setStage] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const [selectedLevel, setSelectedLevel] = useState<any>({
    price: 0,
    hasVotingPower: false,
    nativeSwapRoute: null,
  })

  const mooneyContract = useContract({
    chain: selectedChain,
    address: MOONEY_ADDRESSES[chainSlug],
    abi: ERC20,
  })
  const vMooneyContract = useContract({
    chain: selectedChain,
    address: VMOONEY_ADDRESSES[chainSlug],
    abi: VotingEscrow,
  })

  const totalMooneyBalance = useTotalMooneyBalance(address)
  const { walletVP: totalLocked } = useTotalVP(address || '')

  const { MOONEY } = useUniswapTokens(selectedChain)

  const { generateRoute: generateNativeRoute } = useUniversalRouter(
    selectedLevel.price + 1,
    MOONEY,
    nativeOnChain(selectedChain.id)
  )

  useEffect(() => {
    if (user && selectedLevel.price > 0) {
      setStage(1)
    }

    if (selectedLevel.price != 0) {
      generateNativeRoute(TradeType.EXACT_OUTPUT).then((swapRoute: any) => {
        setSelectedLevel((prev: any) => ({
          ...prev,
          nativeSwapRoute: swapRoute,
        }))
      })
    }
  }, [selectedLevel.price, address, selectedChain, user])

  //skip tx stage if user already has a mooney lock greate than the selected level
  useEffect(() => {
    if (
      chainSlug !== 'polygon' &&
      selectedLevel.price > 0 &&
      totalLocked >= 0 &&
      totalMooneyBalance >= 0
    ) {
      if (selectedLevel.hasVotingPower) {
        if (selectedLevel.price / 2 <= totalLocked) {
          setStage(2)
        }
      } else {
        if (selectedLevel.price - 1 <= totalMooneyBalance) {
          setStage(2)
        }
      }
    }
  }, [
    selectedLevel.price,
    totalLocked,
    totalMooneyBalance,
    selectedChain,
    selectedLevel,
  ])

  useEffect(() => {
    if (stage > 0) {
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
    }, [trackRef, stage])

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
  const StepOne = () => (
    <StageContainer>
      <div className="flex flex-col font-RobotoMono items-center">
        <div className="flex flex-wrap justify-center items-stretch w-full gap-5 ">
          <ContributionLevels
            selectedChain={selectedChain}
            selectedLevel={selectedLevel}
            setSelectedLevel={setSelectedLevel}
            usdQuotes={usdQuotes}
          />
        </div>
        <div className="flex flex-col gap-4 mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] text-center xl:text-left text-sm xl:text-base">
          <p>
            <Link
              className="text-moon-gold"
              href="https://www.youtube.com/watch?v=V9M-wTRfuZs"
              target="_blank"
              rel="noopener noreferrer"
            >
              {'Watch Tutorial'}
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-4 mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-darkest-cool  rounded-[20px] p-5 dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] text-center xl:text-left text-sm xl:text-base font-[Lato]">
          <p>
            {`
              Custom Membership: Not seeing what's right for you? Advanced users can purchase any amount of
              `}
            <Link
              className="text-moon-gold"
              href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet"
              target="_blank"
              rel="noopener noreferrer"
            >
              $MOONEY via Uniswap
            </Link>{' '}
            {` and `}
            <Link className="text-moon-gold" href="/lock">
              lock
            </Link>{' '}
            {`some or all of that for any amount of
              time between one week and four years to maximize voting power.
              `}
          </p>
          <p>{`*Market data for $MOONEY is being fetched in real-time from decentralized exchanges. Prices may fluctuate over time based on demand.*`}</p>
        </div>
      </div>
    </StageContainer>
  )

  {
    /* Checkout Transaction steps */
  }

  const StepTwo = () => (
    <StageContainer>
      <div className="flex flex-col items-center lg:items-start px-4 lg:px-7 xl:px-9 lg:max-w-[1080px]">
        <div className="flex flex-col w-full"></div>
        <div className="py-4 flex flex-col md:flex-row items-center justify-center gap-12 w-full">
          <button
            className="py-2 px-4 lg:py-3 lg:px-5 lg:self-start transition-all duration-105 hover:scale-105 inline-flex items-center space-x-3 mb-3 lg:mb-0"
            onClick={() => {
              setStage(0)
              setSelectedLevel({ price: 0, hasVotingPower: false })
            }}
          >
            <input type="image" src="/backIcon.png" />
            <span>Back</span>
          </button>
          <div className="relative bottom-2 lg:bottom-0">
            <NetworkSelector />
          </div>
        </div>
        <OnboardingTransactions
          setStage={setStage}
          setSelectedLevel={setSelectedLevel}
          selectedLevel={selectedLevel}
          selectedChain={selectedChain}
          mooneyContract={mooneyContract}
          vMooneyContract={vMooneyContract}
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
      <div className="flex flex-col items-center lg:items-start">
        <h1 className="font-GoodTimes text-[#071732] dark:text-white text-4xl sm:text-5xl text-center lg:text-left">
          Next Steps
        </h1>
        <p className="mt-5 lg:mt-4 xl:mt-6 text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-center lg:text-left text-gray-900 dark:text-gray-100">{`Step 1: Tell your friends about MoonDAO. Top referrals get extra bonuses, like extra entries into our Sweepstakes with Blue Origin!`}</p>

        <a
          className="mt-8 px-6 py-3 lg:px-8 xl:px-10 2xl:px-14 2xl:py-4 bg-moon-orange text-white hover:scale-105 transition-all duration-150 hover:bg-white hover:text-moon-orange"
          href={`https://hub.sparklp.co/c/MF11bc2c5d09c4`}
          target="_blank"
          rel="noreferrer"
        >
          Share referral
        </a>
        <p className="mt-12 xl:mt-14 text-sm sm:text-base lg:text-sm xl:text-base max-w-[698px] text-center lg:text-left text-gray-900 dark:text-gray-100">
          Step 2: Choose how you want to be involved.
        </p>

        <InvolvementOptions />
        {/*Ticket submission button*/}
        {/* <button
          onClick={() =>
            window.open(
              'https://circles.spect.network/r/8e96f155-c255-4567-bca3-8bec6a0b7867'
            )
          }
          className="mt-10 rounded-[20px] py-3 px-4 font-bold lg:absolute dark:bg-white bg-gray-800 text-gray-100 hover:scale-105 dark:text-gray-900 hover:text-moon-orange dark:hover:text-moon-orange transition-all duration-105 lg:-bottom-24 lg:left-6 2xl:left-auto 2xl:right-10 text-xl"
        >
          Questions? Submit a ticket
        </button> */}
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
    { component: <StepOne /> },
    { component: <StepTwo /> },
    { component: <StepThree /> },
    { component: <StepFour /> },
  ]

  return (
    <div className="flex flex-col w-full h-full bg-dark-cool p-5 rounded-[20px]">
      <MultiStepStage steps={steps} />
    </div>
  )
}
