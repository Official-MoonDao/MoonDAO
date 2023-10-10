/*
Onboarding Stages:
0. Welcome to MoonDAO
1. Select Contribution Level
2. Proof of Humanity
*/
import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { ContributionLevels } from './ContributionLevels'
import { OnboardingLock } from './OnboardingLock'

function StageContainer({ children }: any) {
  return <div className="flex flex-col gap-4 justify-center">{children}</div>
}

export function OnboardingStageManager() {
  const { user, login } = usePrivy()
  const [stage, setStage] = useState(0)
  const [selectedLevel, setSelectedLevel] = useState<number>()

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
          <OnboardingLock selectedLevel={selectedLevel} />
        </StageContainer>
      )}
      {stage === 2 && <StageContainer></StageContainer>}
    </div>
  )
}
