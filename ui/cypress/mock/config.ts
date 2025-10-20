import { createThirdwebClient } from 'thirdweb'
import { sepolia } from '@/lib/rpc/chains'

export const cypressThirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
})

export const CYPRESS_CHAIN_SLUG = 'sepolia'
export const CYPRESS_CHAIN_V5 = sepolia
export const CYPRESS_MISSION_TOKEN_ADDRESS =
  '0x3358EB0D0e7083a7172094fFC51d7618482F2c89'
export const CYPRESS_MISSION_PRIMARY_TERMINAL_ADDRESS =
  '0xDB9644369c79C3633cDE70D2Df50d827D7dC7Dbc'
