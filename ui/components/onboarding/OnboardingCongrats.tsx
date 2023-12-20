import { SolarConfetti } from '../assets'

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
          onClick={() => {
            window.open(
              ` https://twitter.com/intent/tweet?text=I%20just%20became%20a%20member%20of%20MoonDAO%3A%20The%20Internet's%20Space%20Program%20%40OfficialMoonDAO%0A%0AJoin%20me%20here%20⬇%EF%B8%8F&url=https%3A%2F%2Fapp.moondao.com%2F`
            )
          }}
        >
          Click to Tweet
        </button>
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
