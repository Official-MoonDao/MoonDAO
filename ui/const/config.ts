import { useContext, useMemo } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'

const zeroAddress = '0x0000000000000000000000000000000000000000'

interface DeploymentConfig {
  MOONEYToken: string
  vMOONEYToken: string
  vMooneySweepstakesZeroG_v1: string
}

interface Config {
  MOONEYToken: string
  vMOONEYToken: string
  vMooneySweepstakesZeroG: string
  vMOONEYRequiredStake: number
}

//vMooneySweepstakesZeroG is always mainnet address (using infura provider)

export default function useContractConfig() {
  const { selectedChain } = useContext(ChainContext)

  const config = useMemo(() => {
    const defaultConfig =
      require(`../../contracts/deployments/${selectedChain.slug.toLowerCase()}.json`) as DeploymentConfig

    return {
      MOONEYToken:
        process.env.NEXT_PUBLIC_MOONEY_ADDRESS ||
        defaultConfig.MOONEYToken ||
        zeroAddress,
      vMOONEYToken:
        process.env.NEXT_PUBLIC_VMOONEY_ADDRESS ||
        defaultConfig.vMOONEYToken ||
        zeroAddress,
      vMOONEYRequiredStake:
        Number(process.env.NEXT_PUBLIC_VMOONEY_REQUIRED_STAKE) || 1,
      vMooneySweepstakesZeroG: '0xB255c74F8576f18357cE6184DA033c6d93C71899',
    }
  }, [selectedChain])

  return config as Config
}
