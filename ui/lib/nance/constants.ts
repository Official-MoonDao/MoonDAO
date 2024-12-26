// use chainId as env var for detecting dev mode
const prod = process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
export const NANCE_SPACE_NAME = 'waterbox'
export const SNAPSHOT_SPACE_NAME = prod ? 'tomoondao.eth' : 'jigglyjams.eth'

export const proposalIdPrefix = 'MDP-';

export const NANCE_API_URL = 'http://localhost:3003'
