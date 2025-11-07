// use chainId as env var for detecting dev mode
const mainnet = process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
const dev = process.env.NEXT_PUBLIC_ENV === 'dev'
export const NANCE_SPACE_NAME = mainnet || dev ? 'moondao' : 'waterbox'
export const SNAPSHOT_SPACE_NAME =
  mainnet || dev ? 'tomoondao.eth' : 'jigglyjams.eth'

export const proposalIdPrefix = 'MDP-'

export const NANCE_API_URL = 'https://nance-ts-production.up.railway.app'
