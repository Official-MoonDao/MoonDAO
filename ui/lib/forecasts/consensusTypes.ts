export type ForecastCaller = {
  voterAddress: string
  citizenId: number | string
  citizenName: string
  citizenImage?: string
  allocation: number[]
  weight: number
  storedVmooney: number
  liveVmooney: number
  brier: number | null
  skill: number | null
}

export type ForecastConsensus = {
  voteId: number
  deprizeId: number
  vector: number[]
  backersByOutcome: number[]
  participants: number
  totalWeight: number
  revealed: boolean
  leaderboard: ForecastCaller[]
}
