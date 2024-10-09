import { useEffect, useState } from 'react'
import CitizenContext from './citizen-context'
import useCitizen from './useCitizen'

export default function CitizenProvider({ selectedChain, children }: any) {
  const [citizen, setCitizen] = useState<any>()
  const citizenNft = useCitizen(selectedChain)

  useEffect(() => {
    setCitizen(citizenNft)
  }, [citizenNft])

  return (
    <CitizenContext.Provider value={{ citizen, setCitizen }}>
      {children}
    </CitizenContext.Provider>
  )
}
