import { useEffect, useState } from 'react'

const APIKEY = ''
const SCORERID = ''

type Stamp = {
  id: number
  stamp: string
}

export function useGitcoinScore(walletAddress: string) {
  const [score, setScore] = useState<number>(0)

  async function getPassportScore() {
    return null
  }

  useEffect(() => {
    getPassportScore()
  }, [walletAddress])

  return score
}
