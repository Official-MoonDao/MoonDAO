import { BigNumber } from 'ethers'
import { useEffect, useState } from 'react'

export function useValidPass(expiresAt: BigNumber) {
  const [validPass, setValidPass] = useState<boolean>(false)

  function checkPass() {
    const expires = new Date(+expiresAt?.toString() * 1000)
    const now = new Date()

    setValidPass(expires > now)
  }

  useEffect(() => {
    checkPass()
  }, [expiresAt])

  return validPass
}
