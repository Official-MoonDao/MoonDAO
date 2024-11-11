import { useEffect, useState } from 'react'
import CitizenContext from './citizen-context'
import { useCitizen } from './useCitizen'

export default function CitizenProvider({
  selectedChain,
  children,
  mock = false,
}: any) {
  const [citizen, setCitizen] = useState<any>()
  const citizenNft = useCitizen(selectedChain)

  useEffect(() => {
    if (mock) setCitizen(mock)
    else setCitizen(citizenNft)
  }, [citizenNft, mock])

  return (
    <CitizenContext.Provider value={{ citizen, setCitizen }}>
      {children}
    </CitizenContext.Provider>
  )
}
