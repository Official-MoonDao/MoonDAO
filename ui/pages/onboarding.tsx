import Head from '../components/layout/Head'
import { OnboardingStageManager } from '../components/onboarding/OnboardingStageManager'

export default function Onboarding() {
  return (
    <div className="animate-fadeIn">
      <Head title="Onboarding" />
      <OnboardingStageManager />
    </div>
  )
}
