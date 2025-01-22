import { createContext } from 'react'

const CitizenContext = createContext<{
  citizen: any
  setCitizen: (citizen: any) => void
}>({
  citizen: undefined,
  setCitizen: (citizen: any) => {},
})

export default CitizenContext
