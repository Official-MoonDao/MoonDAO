import DePrizeAvailabilityLegend from '@/components/deprize/DePrizeAvailabilityLegend'
import Container from '@/components/layout/Container'
import Head from '@/components/layout/Head'
import { DEPRIZE_AVAILABILITY_LEGEND } from '@/lib/deprize/constants'

/** Shown instead of DePrize market UI when the request country is restricted or unknown. */
export default function DePrizeRestrictedNotice() {
  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head title="DePrize" description={DEPRIZE_AVAILABILITY_LEGEND} />
      <Container>
        <div className="w-full max-w-[760px] mx-auto pt-16 sm:pt-24 pb-10 px-4">
          <p className="text-center text-white text-lg sm:text-xl">
            DePrize is not available in your location.
          </p>
          <DePrizeAvailabilityLegend />
        </div>
      </Container>
    </div>
  )
}
