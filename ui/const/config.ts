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

const devConfigSepolia =
  require(`../../contracts/deployments/sepolia`) as DeploymentConfig

export const MOONEY_ADDRESSES: Index = {
  ethereum: defaultConfigL1.MOONEYToken,
  polygon: defaultConfigL2.MOONEYToken,
  goerli: devConfigL1.MOONEYToken,
  mumbai: devConfigL2.MOONEYToken,
  sepolia: devConfigSepolia.MOONEYToken,
}

export const DAI_ADDRESSES: Index = {
  ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  polygon: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  mumbai: '0xd393b1E02dA9831Ff419e22eA105aAe4c47E1253',
  sepolia: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
}

export const MOONEY_DECIMALS = 10 ** 18

export const VMOONEY_ADDRESSES: Index = {
  ethereum: defaultConfigL1.vMOONEYToken,
  polygon: defaultConfigL2.vMOONEYToken,
  goerli: devConfigL1.vMOONEYToken,
  mumbai: devConfigL2.vMOONEYToken,
  sepolia: devConfigSepolia.vMOONEYToken,
}

export const CITIZEN_NFT_ADDRESSES: Index = {
  ethereum: '',
  polygon: '0xE8013d1B68FA9faF5C78DE4823f7F076A854407A',
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
const MONGO_PATH_SUFFIX = process.env.MONGO_PATH_SUFFIX || ''
const MONGO_URL = `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_PATH_SUFFIX}`

export const mongoConfig = {
  url: MONGO_URL,
}

export const TICKET_TO_SPACE_ADDRESS =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? '0x6434c90c9063F0Bed0800a23c75eBEdDF71b6c52' //polygon
    : '0x5283b6035cfa7bb884b7f6a146fa6824ec9773c7' //mumbai

export const ENTITY_ADDRESSES: Index = {
  ethereum: '',
  sepolia: '0xC01F000a4D8082E648dEFe70b4013541C1F25855',
}

export const ENTITY_CREATOR_ADDRESSES: Index = {
  ethereum: '',
  sepolia: '0xE360D4cca0D63620B4a6dB5b7084B77c21dD41D3',
}

export const CITIZEN_ADDRESSES: Index = {
  ethereum: '',
  sepolia: '0x355ef23f7e3Cec6f82C3C7bBfb711454FA0C4CB7',
}

export const HATS_ADDRESS = '0x3bc1A0Ad72417f2d411118085256fC53CBdDd137'

export const DISCORD_GUILD_ID = '914720248140279868'
