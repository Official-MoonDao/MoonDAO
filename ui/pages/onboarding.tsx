import { Polygon } from '@thirdweb-dev/chains'
import { useContext, useEffect } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import Head from '../components/layout/Head'
import { OnboardingStageManager } from '../components/onboarding/OnboardingStageManager'

export default function Onboarding() {
  const { setSelectedChain } = useContext(ChainContext)

  useEffect(() => {
    setSelectedChain(Polygon)
  }, [])

  return (
    <div className="animate-fadeIn">
      <Head title="Onboarding" />
      <OnboardingStageManager />
    </div>
  )
}
