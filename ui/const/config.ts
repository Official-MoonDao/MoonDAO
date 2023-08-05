import { useChain, useSDK } from '@thirdweb-dev/react'
import { useContext, useEffect, useMemo, useState } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'

const zeroAddress = '0x0000000000000000000000000000000000000000'

interface DeploymentConfig {
  MOONEYToken: string
  vMOONEYToken: string
  vMooneySweepstakesZeroG: string
}

interface Config {
  MOONEYToken: string
  vMOONEYToken: string
  vMooneySweepstakesZeroG: string
  vMOONEYRequiredStake: number
}

type Index = { [key: string]: string }

const isMainnet = process.env.NEXT_PUBLIC_CHAIN === 'mainnet'

//vMooneySweepstakesZeroG is always mainnet address (using infura provider)
const defaultConfigL1 =
  require(`../../contracts/deployments/ethereum`) as DeploymentConfig

const defaultConfigL2 =
  require(`../../contracts/deployments/polygon`) as DeploymentConfig

const devConfigL1 =
  require(`../../contracts/deployments/goerli`) as DeploymentConfig

const devConfigL2 =
  require(`../../contracts/deployments/mumbai`) as DeploymentConfig

export const MOONEY_ADDRESSES: Index = {
  ethereum: defaultConfigL1.MOONEYToken,
  polygon: defaultConfigL2.MOONEYToken,
  goerli: devConfigL1.MOONEYToken,
  mumbai: devConfigL2.MOONEYToken,
}

export const VMOONEY_ADDRESSES: Index = {
  ethereum: defaultConfigL1.vMOONEYToken,
  polygon: defaultConfigL2.vMOONEYToken,
  goerli: devConfigL1.vMOONEYToken,
  mumbai: devConfigL2.vMOONEYToken,
}

export const VMOONEY_SWEEPSTAKES: string =
  defaultConfigL1.vMooneySweepstakesZeroG

// export default function useContractConfig() {
//   const { selectedChain } = useContext(ChainContext)

//   const config = useMemo(() => {

//     return {
//       MOONEYToken:
//         process.env.NEXT_PUBLIC_MOONEY_ADDRESS ||
//         defaultConfig.MOONEYToken ||
//         zeroAddress,
//       vMOONEYToken:
//         process.env.NEXT_PUBLIC_VMOONEY_ADDRESS ||
//         defaultConfig.vMOONEYToken ||
//         zeroAddress,
//       vMOONEYRequiredStake:
//         Number(process.env.NEXT_PUBLIC_VMOONEY_REQUIRED_STAKE) || 1,
//       vMooneySweepstakesZeroG: '0xB255c74F8576f18357cE6184DA033c6d93C71899',
//     }
//   }, [selectedChain])

//   return config as Config
// }
