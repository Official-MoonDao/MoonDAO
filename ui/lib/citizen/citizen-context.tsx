import { createContext } from 'react'

const CitizenContext = createContext({
  citizen: undefined,
  setCitizen: (citizen: any) => {},
})

export default CitizenContext
