import OnboardingCallLogo from "./assets/OnboardingCallLogo"

export function ProofOfHumanity() {
  function Card({ label, description, children }: any) {
    return (
      <div className="flex flex-col w-[320px] h-[356px] py-8 px-5 border-white border-opacity-20 border font-RobotoMono">
        <OnboardingCallLogo/>
        <div className="mt-7">
        <h1 className="font-bold text-[20px] min-h-[60px]">{label}</h1>
        <p className="mt-3 min-h-[90px]">{description}</p>
       <button className="mt- px-[10px] py-[10px] border border-white border-opacity-[0.16] font-bold text-[20px]">Add Passport</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-[43px] flex flex-col lg:flex-row gap-7">
      <Card
        label={'Gitcoin Passport'}
        description={'Achieve a score of 15 or more.'}
      ></Card>
      <Card
        label={'5 Minute Onboarding Call'}
        description={
          'Breifly meet with an onboarding operator as a proof of liveness.'
        }
      ></Card>
      <Card
        label={'Connect to Guild.xyz'}
        description={
          'Access our Discord community with your new unlocked rules.'
        }
      ></Card>
    </div>
  )
}
