import CitizenTier from '@/components/layout/CitizenTier'
import TeamTier from '@/components/layout/TeamTier'

const Pricing = () => {
  return (
    <div id="pricing-container" 
      className="md:mb-10 flex flex-col md:gap-10 md:m-5">
      <CitizenTier />
      <TeamTier />
    </div>
  )
}

export default Pricing