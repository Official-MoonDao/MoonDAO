const zeroAddress = '0x0000000000000000000000000000000000000000'

interface DeploymentConfig {
  MOONEYToken: string
  vMOONEYToken: string
  vMooneySweepstakesZeroG: string
}

type Index = { [key: string]: string }

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
