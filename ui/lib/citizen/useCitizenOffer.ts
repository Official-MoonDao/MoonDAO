import { useContext } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { useCitizenCheckoutLive, usePublicYearEth } from '@/lib/subscription/citizenCheckout'
import {
  displayedYearUsd,
  FALLBACK_CITIZEN_YEAR_USD,
  formatYearlyUsd,
} from '@/lib/subscription/publicYearPrice'

/**
 * Everything the page's CTAs need: one yearly price (server quote first, live
 * quote once it lands) and a destination that sends existing citizens to their
 * dashboard instead of the checkout.
 */
export default function useCitizenOffer(serverYearUsd: number) {
  const { citizen } = useContext(CitizenContext)
  const priceEth = usePublicYearEth('citizen')
  const cardCheckoutLive = useCitizenCheckoutLive()
  const { data: liveUsd } = useETHPrice(
    priceEth != null && priceEth > 0 ? priceEth : 0,
    'ETH_TO_USD'
  )
  const yearUsd = displayedYearUsd(liveUsd, serverYearUsd, FALLBACK_CITIZEN_YEAR_USD)
  const isCitizen = !!citizen

  return {
    isCitizen,
    ctaHref: isCitizen ? '/dashboard' : '/citizen',
    ctaLabel: isCitizen ? 'Go to Your Dashboard' : 'Become a Citizen',
    yearUsd,
    yearLabel: formatYearlyUsd(yearUsd, FALLBACK_CITIZEN_YEAR_USD),
    perMonthUsd: Math.max(1, Math.round(yearUsd / 12)),
    cardCheckoutLive,
  }
}

export type CitizenOffer = ReturnType<typeof useCitizenOffer>
