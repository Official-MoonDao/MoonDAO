// import { SolarConfetti } from '../assets'

export function OnboardingCongrats() {
    return (
        <div className="flex flex-col font-RobotoMono w-full items-center gap-8">
            {/* <SolarConfetti /> */}
            <div className='mt-9 lg:mt-7 flex flex-col items-center'>
                <h1 className='font-GoodTimes text-2xl lg:text-5xl'>CONGRATULATIONS!</h1>
                <p className='mt-[18px] text-[20px] lg:text-[32px] text-center'>You're in the MoonDAO community</p>
                <button className="mt-[44px] lg:mt-[68px] px-[62px] py-4 bg-moon-orange">What's next?</button>
            </div>
        </div>
    )
}