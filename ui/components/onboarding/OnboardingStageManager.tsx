import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { ContributionLevels } from './ContributionLevels'
import {ContributionModal}  from './ContributionModal'
import { OnboardingCongrats } from './OnboardingCongrats'
import { ProofOfHumanity } from './ProofOfHumanity'

/*
Onboarding Stages:
0. Welcome to MoonDAO
1. Select Contribution Level
2. Congrats
3. Proof of Humanity
*/

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
  const [selectedLevel, setSelectedLevel] = useState<number>(0)

  useEffect(() => {
    if (user && stage === 0) {
      setStage(1)
    } else if (!user) {
      setStage(0)
    }
  }, [user])

  return (
    <main>
      {stage === 0 && (
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
      )}
      {stage === 1 && (
        <StageContainer>
          <h1 className="text-[#071732] dark:text-white font-GoodTimes text-3xl sm:text-4xl lg:text-5xl text-left">
            Step 1 of 3: Select Contribution Level
          </h1>
          <ContributionLevels
            selectedLevel={selectedLevel}
            setSelectedLevel={setSelectedLevel}
          />
          {/*Modal*/}
          <ContributionModal
            selectedLevel={selectedLevel}
            setSelectedLevel={setSelectedLevel}
          />
        </StageContainer>
      )}
      {stage === 2 && (
        <StageContainer>
          <OnboardingCongrats />
        </StageContainer>
      )}
      {stage === 3 && (
        <StageContainer>
          <h1 className="text-[#071732] dark:text-white font-GoodTimes text-4xl lg:text-5xl text-left">
            Proof of Humanity
          </h1>
          <p className="mt-[15px] text-base opacity-60">{`To access governance and events at MoonDAO you must complete thtese steps.  No identifying data is stored by MoonDAO in this process.`}</p>
          <ProofOfHumanity />
        </StageContainer>
      )}

      {/* DEV BUTTONS -- REMOVE B4 PUSHING TO PROD */}
      <div className="mt-20 gap-2 flex flex-col items-center">
        <h6 className="text-red-500">Dev menu</h6>
        <button
          className="p-2 bg-[blue]"
          onClick={() => setStage(stage - 1)}
          disabled={stage === 0}
        >
          prev stage
        </button>
        <button
          className={`p-2 bg-[blue] ${stage === 3 && 'opacity-50'}`}
          onClick={() => setStage(stage + 1)}
          disabled={stage === 3}
        >
          next next
        </button>
      </div>
    </main>
  )
}
