const zeroAddress = '0x0000000000000000000000000000000000000000'

interface DeploymentConfig {
  MOONEYToken: string
  vMOONEYToken: string
}

interface Config {
  MOONEYToken: string
  vMOONEYToken: string
  vMOONEYRequiredStake: number
}

const chain = process.env.NEXT_PUBLIC_CHAIN || 'sepolia'
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
}

console.log(config)

export const { MOONEYToken, vMOONEYToken, vMOONEYRequiredStake } = config
