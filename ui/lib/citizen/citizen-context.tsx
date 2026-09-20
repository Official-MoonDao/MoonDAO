import { createContext } from 'react'

const CitizenContext = createContext<{
  // Only set while the citizenship subscription is paid up. Every citizen-gated
  // feature keys off this, so a lapsed subscription closes them all at once.
  citizen: any
  // The citizen record of a wallet whose subscription has lapsed. Used by the
  // renewal flow, which still needs the token id and expiration date.
  expiredCitizen: any
  isExpired: boolean
  subscriptionExpiresAt?: number
  setCitizen: (citizen: any) => void
  // Optimistically mark the connected wallet as a citizen (e.g. right after a
  // successful mint) so the app routes to the dashboard immediately instead of
  // waiting on Tableland indexing. The real record replaces it once indexed.
  seedCitizen: (citizen: any) => void
  isLoading: boolean
  isRenewalModalOpen: boolean
  openRenewalModal: () => void
  closeRenewalModal: () => void
}>({
  citizen: undefined,
  expiredCitizen: undefined,
  isExpired: false,
  subscriptionExpiresAt: undefined,
  setCitizen: (citizen: any) => {},
  seedCitizen: (citizen: any) => {},
  isLoading: false,
  isRenewalModalOpen: false,
  openRenewalModal: () => {},
  closeRenewalModal: () => {},
})

export default CitizenContext
