/*
VRF: https://vrf.chain.link/mainnet/691
CONTRACT: https://etherscan.io/address/0xB255c74F8576f18357cE6184DA033c6d93C71899
*/

import { useContractEvent } from 'wagmi'
import vMooneySweepstakesABI from '../abis/vMooneySweepstakes.json'
import { vMooneySweepstakesZeroG } from './config'
import { useContractRead, useContractWrite } from './use-wagmi'

export const contractParams = {
  addressOrName: vMooneySweepstakesZeroG, //mainnet
  contractInterface: vMooneySweepstakesABI,
}

export function useMintTicketZeroG() {
  return useContractWrite(contractParams, 'safeMint', {
    overrides: {
      gasLimit: 300000,
    },
  })
}

export function useRandomSelection() {
  return useContractWrite(contractParams, 'chooseWinner', {
    overrides: {
      gasLimit: 1000000
    },
  })
}

export function useBalanceTicketZeroG(address: string) {
  return useContractRead(contractParams, 'balanceOf', {
    args: [address],
    watch: true,
    enabled: !!address,
  })
}

export function useCurrentWinner() {
  return useContractRead(contractParams, 'winner', {
    watch: true,
  })
}

export function useSweepstakesEvent(listener: Function) {
  return useContractEvent(contractParams, 'RequestFulfilled', (e) => {
    listener(e)
  })
}
