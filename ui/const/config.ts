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
const ethConfig =
  require(`../../contracts/deployments/ethereum`) as DeploymentConfig

const polygonConfig =
  require(`../../contracts/deployments/polygon`) as DeploymentConfig

const arbitrumConfig =
  require('../../contracts/deployments/arbitrum') as DeploymentConfig

const goerliConfig =
  require(`../../contracts/deployments/goerli`) as DeploymentConfig

const sepoliaConfig =
  require(`../../contracts/deployments/sepolia`) as DeploymentConfig

const arbitrumSepoliaConfig =
  require('../../contracts/deployments/arbitrum-sepolia') as DeploymentConfig

export const MOONEY_ADDRESSES: Index = {
  ethereum: ethConfig.MOONEYToken,
  polygon: polygonConfig.MOONEYToken,
  goerli: goerliConfig.MOONEYToken,
  sepolia: sepoliaConfig.MOONEYToken,
  arbitrum: arbitrumConfig.MOONEYToken,
  'arbitrum-sepolia': arbitrumSepoliaConfig.MOONEYToken,
}

export const DAI_ADDRESSES: Index = {
  ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  polygon: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  sepolia: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
  arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  'arbtirum-sepolia': '0x8B90f054565718097BD583C2dF4260c9E8fb6464',
}

export const USDC_ADDRESSES: Index = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}

export const MOONEY_DECIMALS = 10 ** 18

export const VMOONEY_ADDRESSES: Index = {
  ethereum: ethConfig.vMOONEYToken,
  polygon: polygonConfig.vMOONEYToken,
  goerli: goerliConfig.vMOONEYToken,
  sepolia: sepoliaConfig.vMOONEYToken,
  arbitrum: arbitrumConfig.vMOONEYToken,
}

export const CITIZEN_NFT_ADDRESSES: Index = {
  ethereum: '',
  polygon: '0xE8013d1B68FA9faF5C78DE4823f7F076A854407A',
}

export const CITIZEN_ADDRESSES: Index = {
  arbitrum: '0x061570c3a2DF455d61f8386489bea516Dd7664DE',
  sepolia: '0x31bD6111eDde8D8D6E12C8c868C48FF3623CF098',
}

export const CITIZEN_TABLE_ADDRESSES: Index = {
  arbitrum: '0x0ad4923AcfBA7Ae935A54db27EF5198146f4Ea24',
  sepolia: '0x369E322EC264dB091ef30032f3ac9B5Da628FE50',
}

export const TEAM_ADDRESSES: Index = {
  arbitrum: '0x282D0ee585CCf868935b4009897909b4F3E20038',
  sepolia: '0xB3F092d6f294cAdcdE1567CC179845C77b2471c1',
}

export const TEAM_CREATOR_ADDRESSES: Index = {
  arbitrum: '0xF83BB7b2C1204AecFDF5953De871C2f8b18FD0b6',
  sepolia: '0xC74cd85D25Ae0241a5804B96b035B933f8FE05C2',
}

export const TEAM_TABLE_ADDRESSES: Index = {
  arbitrum: '0xc6021297484CCA23be62ee328871ED81eAA9149A',
  sepolia: '0x42Ac8bE10c1CbAB68B399B54F2b43454dF8963e9',
}

export const MOONDAO_HAT_TREE_IDS: Index = {
  arbitrum: '0x0000001a',
  sepolia: '0x00000162',
}

export const JOBS_TABLE_ADDRESSES: Index = {
  arbitrum: '0x20E1a0048ACc0C9eF82846D7Df56Dd07E84A4bC4',
  sepolia: '0x461BA6806eacfcD8ae3B7658Af64D77622889643',
}

export const MARKETPLACE_ADDRESS =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? polygonConfig.Marketplace
    : sepoliaConfig.Marketplace

export const MARKETPLACE_TABLE_ADDRESSES: Index = {
  arbitrum: '0x65726Ba30707d1546fB64a3a6a9B1AD6d923Dc90',
  sepolia: '0x23b0916866d23C77651c2D76E71663dBaa26f130',
}

export const VMOONEY_SWEEPSTAKES: string = ethConfig.vMooneySweepstakesZeroG

export const MARKETPLACE_FEE_SPLIT: string =
  polygonConfig.MarketplaceFeeSplit || ''

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

export const NEWSLETTER_FORM_ID = '3715552'

export const UNIVERSAL_ROUTER_ADDRESSES: Index = {
  ethereum: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  polygon: '0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2',
  sepolia: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  arbitrum: '0x5E325eDA8064b456f4781070C0738d849c824258',
  'arbitrum-sepolia': '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
}

export const DISCORD_GUILD_ID = '914720248140279868'

export const HATS_ADDRESS = '0x3bc1A0Ad72417f2d411118085256fC53CBdDd137'

export const TABLELAND_ENDPOINT = `https://${
  process.env.NEXT_PUBLIC_CHAIN != 'mainnet' && 'testnets.'
}tableland.network/api/v1/query`
