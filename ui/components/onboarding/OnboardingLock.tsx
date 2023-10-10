export function OnboardingLock({ selectedLevel }: any) {
  return (
    <div className="flex flex-col bg-background-light dark:bg-background-dark">
      <label>LOCK AMOUNT</label>
      <input className="px-2 bg-background-light dark:bg-background-dark border-2 rounded-lg" />
      <input type="range" className="py-2" />

      <label>DURATION</label>
      <input className="px-2 bg-background-light dark:bg-background-dark border-2 rounded-lg" />
      <input type="range" className="py-2" />

      <div className="border-2 border-[red] flex flex-col justify-center items-center">
        <p>{'Total Voting Power (vPWR)'}</p>
        <p className="text-3xl">4000 vPWR</p>
      </div>
    </div>
  )
}
