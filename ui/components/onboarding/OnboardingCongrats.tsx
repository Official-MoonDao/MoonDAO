import { SolarConfetti } from '../assets'

export function OnboardingCongrats() {
  return (
    <div className="flex flex-col w-full items-center gap-8">
      <SolarConfetti />
      <h1>CONGRATULATIONS!</h1>
      <p>You're in the MoonDAO community</p>
      <button className="px-8 py-4 bg-n3green">What's Next?</button>
    </div>
  )
}
