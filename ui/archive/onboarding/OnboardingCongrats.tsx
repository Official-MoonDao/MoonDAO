import { SolarConfetti } from '../../components/assets'

export function OnboardingCongrats({ progress }: any) {
  return (
    <div className="flex flex-col font-RobotoMono w-full items-center gap-8">
      <SolarConfetti />
      <div className="mt-9 lg:mt-7 flex flex-col items-center  px-4 lg:px-7 xl:px-9">
        <h1 className="font-GoodTimes text-2xl title-text-colors lg:text-5xl">
          CONGRATULATIONS!
        </h1>
        <p className="mt-[18px] lg:mt-4 text-[20px] lg:text-[24px] 2xl:text-3xl text-center text-slate-800 dark:text-gray-200">
          You are successfully onboarded into MoonDAO
        </p>
        <button
          className="mt-[44px] lg:mt-[68px] px-[62px] py-4 bg-moon-orange hover:scale-105 transition-all duration-150 hover:text-moon-orange hover:bg-white"
          onClick={progress}
        >
          What's next?
        </button>
      </div>
    </div>
  )
}
