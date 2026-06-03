import { createContext } from 'react'

const CitizenContext = createContext<{
  citizen: any
  setCitizen: (citizen: any) => void
  // Optimistically mark the connected wallet as a citizen (e.g. right after a
  // successful mint) so the app routes to the dashboard immediately instead of
  // waiting on Tableland indexing. The real record replaces it once indexed.
  seedCitizen: (citizen: any) => void
  isLoading: boolean
}>({
  citizen: undefined,
  setCitizen: (citizen: any) => {},
  seedCitizen: (citizen: any) => {},
  isLoading: false,
})

export default CitizenContext
