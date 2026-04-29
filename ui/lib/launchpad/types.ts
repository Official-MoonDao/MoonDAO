import { Chain } from 'thirdweb'

export type LaunchStatus = 'idle' | 'loggingIn' | 'apply' | 'create'

export type Mission = {
  id: string
  teamId: string | null
  projectId: string | null
  fundingGoal?: number
  metadata: {
    name: string
    description?: string
    tagline?: string
    logoUri?: string
    image?: string
  }
}

export type FeaturedMissionData = {
  mission: Mission
  _stage: number
  // `null` is the on-the-wire marker for "missing"; `undefined` cannot be
  // serialized through getStaticProps.
  _deadline: number | null
  _refundPeriod: number | null
  _primaryTerminalAddress: string
  _token: {
    tokenAddress: string
    tokenName: string
    tokenSymbol: string
    tokenSupply: string
  }
  _fundingGoal: number
  _ruleset: Array<{ weight: number; reservedPercent: number }> | null
  projectMetadata: Mission['metadata'] | null
}

export type UserTeam = {
  teamId: string
  hats: Array<{
    id: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export type TeamManagerCheckResult = {
  userTeamsAsManager: UserTeam[]
  isLoading: boolean
}

export type LaunchpadAccessResult = {
  hasAccess: boolean
  isLoading: boolean
  requiresLogin: boolean
}

export type LaunchStatusResult = {
  status: LaunchStatus
  setStatus: (status: LaunchStatus) => void
  handleCreateMission: () => Promise<void>
}

export type Contract = any
export type ChainType = Chain

