import CitizenTier from '@/components/onboarding/CitizenTier'
import TeamTier from '@/components/onboarding/TeamTier'

type PricingProps = {
  setSelectedTier: Function
}

const Pricing = ({ setSelectedTier }: PricingProps) => {
  return (
    <div
      id="pricing-container"
      className="md:mb-10 flex flex-col md:gap-10 md:m-5"
    >
      <CitizenTier setSelectedTier={setSelectedTier} />
      <TeamTier setSelectedTier={setSelectedTier} />
    </div>
  )
}

export default Pricing
