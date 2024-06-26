const prod = process.env.NODE_ENV === 'production'

export const NANCE_SPACE_NAME = prod ? 'moondao' : 'waterbox'
export const SNAPSHOT_SPACE_NAME = prod ? 'tomoondao.eth' : 'jigglyjams.eth'

export const proposalIdPrefix = 'MDP-';

export const NANCE_API_URL = prod ? 'https://api.nance.app' : 'http://localhost:3003'
