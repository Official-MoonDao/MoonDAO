/*
VRF: https://vrf.chain.link/mainnet/691
CONTRACT: https://etherscan.io/address/0xB255c74F8576f18357cE6184DA033c6d93C71899
*/
import { SmartContract } from '@thirdweb-dev/react'
import { useHandleRead } from '../thirdweb/hooks'
import { useHandleWrite } from '../thirdweb/hooks'

export const ZERO_G_V1_TOTAL_TOKENS = 19

export function useMintTicketZeroG(
  sweepstakesContract: SmartContract | undefined
) {
  return useHandleWrite(sweepstakesContract, 'safeMint')
}

export function useRandomSelection(
  sweepstakesContract: SmartContract | undefined
) {
  return useHandleWrite(sweepstakesContract, 'chooseWinner')
}

export function useBalanceTicketZeroG(
  sweepstakesContract: SmartContract | undefined,
  address: string
) {
  return useHandleRead(sweepstakesContract, 'balanceOf', [address])
}

export function useCurrentWinner(
  sweepstakesContract: SmartContract | undefined
) {
  return useHandleRead(sweepstakesContract, 'winner')
}
