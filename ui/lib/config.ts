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

const chain = process.env.NEXT_PUBLIC_CHAIN
const defaultConfig =
  require(`../../contracts/deployments/${chain}.json`) as DeploymentConfig
const config: Config = {
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
  vMooneySweepstakesZeroG:
    process.env.NEXT_PUBLIC_SWEEPSTAKES_ADDRESS ||
    defaultConfig.vMooneySweepstakesZeroG_v1,
}

console.log(config)

export const {
  MOONEYToken,
  vMOONEYToken,
  vMooneySweepstakesZeroG,
  vMOONEYRequiredStake,
} = config
