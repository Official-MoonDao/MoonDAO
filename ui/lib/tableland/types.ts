export type DistributionVote = {
  address: string
  vote: { [key: string]: number }
  citizenId?: number
  citizenName?: string
}
