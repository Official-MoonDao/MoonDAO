import { SolarConfetti } from '../assets'

export function OnboardingCongrats() {
  return (
    <div className="flex flex-col font-RobotoMono w-full items-center gap-8">
      <SolarConfetti />
      <div className='mt-9 lg:mt-7 flex flex-col items-center'>
      <h1 className='font-acme text-3xl title-text-colors lg:text-5xl'>CONGRATULATIONS!</h1>
      <p className='mt-[18px] lg:mt-4 text-[20px] lg:text-[24px] 2xl:text-3xl text-center'>You are successfully onboarded into MoonDAO</p>
      <button className="mt-[44px] lg:mt-[68px] px-[62px] py-4 bg-moon-orange hover:scale-105 transition-all duration-150 hover:text-moon-orange hover:bg-white">What's next?</button>
      </div>
    </div>
  )
}
