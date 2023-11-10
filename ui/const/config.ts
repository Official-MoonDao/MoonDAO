export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

interface DeploymentConfig {
  MOONEYToken: string
  vMOONEYToken: string
  vMooneySweepstakesZeroG: string
  Marketplace?: string
  MarketplaceFeeSplit?: string
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

export const MOONEY_DECIMALS = 10 ** 18

export const VMOONEY_ADDRESSES: Index = {
  ethereum: defaultConfigL1.vMOONEYToken,
  polygon: defaultConfigL2.vMOONEYToken,
  goerli: devConfigL1.vMOONEYToken,
  mumbai: devConfigL2.vMOONEYToken,
}

export const VMOONEY_SWEEPSTAKES: string =
  defaultConfigL1.vMooneySweepstakesZeroG

export const MARKETPLACE_FEE_SPLIT: string =
  defaultConfigL2.MarketplaceFeeSplit || ''

export const MARKETPLACE_ADDRESS: string =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? defaultConfigL2.Marketplace || ''
    : devConfigL2.Marketplace || ''

export const MOONDAO_L2_TREASURY: string =
  '0x8C0252c3232A2c7379DDC2E44214697ae8fF097a'
export const DEAD_ADDRESS: string =
  ' 0x000000000000000000000000000000000000dEaD'

// DB Config
const MONGO_USERNAME = process.env.MONGO_USERNAME || ''
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || ''
const MONGO_URL = `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@cluster0.i05bxut.mongodb.net`

export const mongoConfig = {
  url: MONGO_URL,
}
