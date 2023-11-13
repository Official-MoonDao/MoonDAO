import { useContext } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import Head from '../components/layout/Head'
import { OnboardingStageManager } from '../components/onboarding/OnboardingStageManager'

export default function Onboarding() {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  return (
    <div className="animate-fadeIn">
      <Head title="Onboarding" />
      <OnboardingStageManager selectedChain={selectedChain} />
    </div>
  )
}
