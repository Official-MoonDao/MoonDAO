/*
VRF: https://vrf.chain.link/mainnet/691
CONTRACT: https://etherscan.io/address/0xB255c74F8576f18357cE6184DA033c6d93C71899
*/
import { readContract } from '@wagmi/core'
import { random } from 'cypress/types/lodash'
import { useEffect, useState } from 'react'
import { useContractEvent } from 'wagmi'
import vMooneySweepstakesABI from '../abis/vMooneySweepstakes.json'
import { vMooneySweepstakesZeroG } from './config'
import { useContractRead, useContractWrite } from './use-wagmi'

export const contractParams = {
  addressOrName: vMooneySweepstakesZeroG, //mainnet
  contractInterface: vMooneySweepstakesABI,
}

const vMooneySweepstakes_Sepolia_totalSupply = 5 //Sepolia

const vMooneySweepstakes_Mainnet_totalSupply = 19 //Mainnet

export const ZERO_G_V1_TOTAL_TOKENS =
  process.env.NEXT_PUBLIC_CHAIN === 'sepolia'
    ? vMooneySweepstakes_Sepolia_totalSupply
    : vMooneySweepstakes_Mainnet_totalSupply

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
      gasLimit: 1000000,
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
