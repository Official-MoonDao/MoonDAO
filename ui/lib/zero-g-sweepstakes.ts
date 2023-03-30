/*
VRF: https://vrf.chain.link/mainnet/691
CONTRACT: https://etherscan.io/address/0xB255c74F8576f18357cE6184DA033c6d93C71899
*/
import vMooneySweepstakesABI from '../abis/vMooneySweepstakes.json'
import { useContractRead, useContractWrite } from './use-wagmi'

const contractParams = {
  addressOrName: '0xB255c74F8576f18357cE6184DA033c6d93C71899', //mainnet
  contractInterface: vMooneySweepstakesABI,
}

export function useMintTicketZeroG() {
  return useContractWrite(contractParams, 'safeMint', {
    overrides: {
      gasLimit: 300000,
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
