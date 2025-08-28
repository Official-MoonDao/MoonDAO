import { createContext } from 'react'

const CitizenContext = createContext<{
  citizen: any
  setCitizen: (citizen: any) => void
  isLoading: boolean
}>({
  citizen: undefined,
  setCitizen: (citizen: any) => {},
  isLoading: false,
})

export default CitizenContext
