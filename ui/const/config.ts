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
  arbitrum: '0xa4e531c3b45Bd4ADe6B859F7dc0609E349fc42Fe',
  sepolia: '0x31bD6111eDde8D8D6E12C8c868C48FF3623CF098',
}

export const CITIZEN_TABLE_ADDRESSES: Index = {
  arbitrum: '0xfC54809BC5d382c9EA4130bE6790bDD8DFdDc378',
  sepolia: '0x369E322EC264dB091ef30032f3ac9B5Da628FE50',
}

export const CITIZEN_WHITELIST_ADDRESSES: Index = {
  arbitrum: '0xAAE358dA30143174492835AEf6d89d6E008730f0',
  sepolia: '',
}

export const CITIZEN_DISCOUNTLIST_ADDRESSES: Index = {
  arbitrum: '0x4cF33BF9F21232FF2eD97b3873d172322aCE3cfE',
  sepolia: '',
}

export const CITIZEN_ROW_CONTROLLER_ADDRESSES: Index = {
  arbitrum: '0x1f994cB6153C2F1CdE66f4E4F4aeb7A1939Dc39E',
  sepolia: '',
}

export const TEAM_ADDRESSES: Index = {
  arbitrum: '0xf2Bc5f25634F5F46982F85411c5623Cb764290AB',
  sepolia: '0xEb9A6975381468E388C33ebeF4089Be86fe31d78',
}

export const TEAM_CREATOR_ADDRESSES: Index = {
  arbitrum: '0x6bECb28Ecc8243508Adb73F00F5C342003aA765c',
  sepolia: '0x55D07Ab23092edc7EdAEC7048B784aCcb2cc4469',
}

export const TEAM_TABLE_ADDRESSES: Index = {
  arbitrum: '0xf03186c7abb242aFac62E2746Aa0e7650F5bb46e',
  sepolia: '0x42d356e77f6d9Bad870865e0973Ed32F54fA4006',
}

export const TEAM_WHITELIST_ADDRESSES: Index = {
  arbitrum: '0xf52532121f340Af23Bf4Fdb56d83CA80A6526d59',
  sepolia: '',
}
export const TEAM_DISCOUNTLIST_ADDRESSES: Index = {
  arbitrum: '0xEc0224b7C136bFe7d8C8D74Ce258892299bdEdeE',
  sepolia: '',
}

export const MOONDAO_HAT_TREE_IDS: Index = {
  arbitrum: '0x00000024',
  sepolia: '0x0000017c',
}

export const JOBS_TABLE_ADDRESSES: Index = {
  arbitrum: '0xdcbAe309b921e65E5593D4198dD464d969B8C4D7',
  sepolia: '0x1c588261069604490e73188343B2C930F35ae2EF',
}

export const MARKETPLACE_ADDRESS =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? polygonConfig.Marketplace
    : sepoliaConfig.Marketplace

export const MARKETPLACE_TABLE_ADDRESSES: Index = {
  arbitrum: '0xC51aA86303847E9689c170Bf32dFcDE3DB083365',
  sepolia: '0xC066269774c8f216054F8C4db14F4C321Dc75710',
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

export const HATS_PASSTHROUGH_MODULE_ADDRESS =
  '0x56a36BF4c5fdB7A464e31a4ab0dc1B996d4c8F5d'

export const TABLELAND_ENDPOINT = `https://${
  process.env.NEXT_PUBLIC_CHAIN != 'mainnet' && 'testnets.'
}tableland.network/api/v1/query`
