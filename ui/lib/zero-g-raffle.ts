import vMooneyRaffleABI from '../abis/vMooneyRaffleABI.json'
import { useContractRead, useContractWrite } from './use-wagmi'

const contractParams = {
  addressOrName: '0xC0a5B9D608BD0a04F03fACe7c0eD52d197953d3B',
  contractInterface: vMooneyRaffleABI,
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
