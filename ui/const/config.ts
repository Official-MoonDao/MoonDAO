import { arbitrum, sepolia, arbitrumSepolia } from 'thirdweb/chains'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const DEPLOYED_ORIGIN =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? 'https://moondao.com'
    : 'https://moondao-ce-demo.netlify.app'

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

const baseConfig =
  require('../../contracts/deployments/base') as DeploymentConfig

const goerliConfig =
  require(`../../contracts/deployments/goerli`) as DeploymentConfig

const sepoliaConfig =
  require(`../../contracts/deployments/sepolia`) as DeploymentConfig

const arbitrumSepoliaConfig =
  require('../../contracts/deployments/arbitrum-sepolia') as DeploymentConfig

const baseSepoliaConfig =
  require('../../contracts/deployments/base-sepolia') as DeploymentConfig

export const TEST_CHAIN =
  process.env.NEXT_PUBLIC_TEST_CHAIN === 'arbitrum-sepolia'
    ? arbitrumSepolia
    : sepolia
export const DEFAULT_CHAIN_V5 =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : TEST_CHAIN

export const MOONEY_ADDRESSES: Index = {
  ethereum: ethConfig.MOONEYToken,
  polygon: polygonConfig.MOONEYToken,
  goerli: goerliConfig.MOONEYToken,
  sepolia: sepoliaConfig.MOONEYToken,
  arbitrum: arbitrumConfig.MOONEYToken,
  base: baseConfig.MOONEYToken,
  'arbitrum-sepolia': arbitrumSepoliaConfig.MOONEYToken,
  'base-sepolia-testnet': baseSepoliaConfig.MOONEYToken,
}

export const DAI_ADDRESSES: Index = {
  ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  polygon: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  sepolia: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
  arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  base: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  'arbtirum-sepolia': '0x8B90f054565718097BD583C2dF4260c9E8fb6464',
  'base-sepolia-testnet': '0x24E1Ccbd839605210BD6be9e32b64D0886AB24Cf',
}

export const USDC_ADDRESSES: Index = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia-testnet': '0x5dEaC602762362FE5f135FA5904351916053cF70',
}

export const USDT_ADDRESSES: Index = {
  ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  sepolia: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  base: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  'base-sepolia-testnet': '0x4DBD49a3aE90Aa5F13091ccD29A896cbb5B171EB',
}

export const MOONEY_DECIMALS = 10 ** 18

export const VMOONEY_ADDRESSES: Index = {
  ethereum: ethConfig.vMOONEYToken,
  polygon: polygonConfig.vMOONEYToken,
  goerli: goerliConfig.vMOONEYToken,
  sepolia: sepoliaConfig.vMOONEYToken,
  arbitrum: arbitrumConfig.vMOONEYToken,
  base: baseConfig.vMOONEYToken,
  'arbitrum-sepolia': arbitrumSepoliaConfig.vMOONEYToken,
  'base-sepolia-testnet': baseSepoliaConfig.vMOONEYToken,
}

export const CITIZEN_NFT_ADDRESSES: Index = {
  ethereum: '',
  polygon: '0xE8013d1B68FA9faF5C78DE4823f7F076A854407A',
}

export const CITIZEN_ADDRESSES: Index = {
  arbitrum: '0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002',
  sepolia: '0x31bD6111eDde8D8D6E12C8c868C48FF3623CF098',
  'arbitrum-sepolia': '0x853d6B4BA61115810330c7837FDD24D61CBab855',
}

export const CITIZEN_TABLE_ADDRESSES: Index = {
  arbitrum: '0x8F14E436fa0fFcD4239733686d190F1e4F1b84E6',
  sepolia: '0x369E322EC264dB091ef30032f3ac9B5Da628FE50',
  'arbitrum-sepolia': '0xfF3F124D91D6eD6A47e1066473a78AaEde4c2fbe',
}

export const CITIZEN_TABLE_NAMES: Index = {
  arbitrum: 'CITIZENTABLE_42161_98',
  sepolia: 'CITIZENTABLE_11155111_1671',
  'arbitrum-sepolia': 'CITIZENTABLE_421614_1058',
}

export const PROJECT_ADDRESSES: Index = {
  arbitrum: '0xCb31829B312923C7502766ef4f36948A7A64cD6A',
  sepolia: '0x19124F594c3BbCb82078b157e526B278C8E9EfFc',
  'arbitrum-sepolia': '0xDC35Dc4F7610678B0389157522734b79ea464101',
}

export const PROJECT_CREATOR_ADDRESSES: Index = {
  arbitrum: '0xe5709Bc44427DCEF81fF2F718DFc6A032fD23bbF',
  sepolia: '0xd1EfE13758b73F2Db9Ed19921eB756fbe4C26E2D',
  'arbitrum-sepolia': '0xde26EcE3C1Ec58057348e3a7B28359c8cDfae56A',
}

export const PROJECT_TABLE_ADDRESSES: Index = {
  arbitrum: '0x83755AF34867a3513ddCE921E9cAd28f0828CDdB',
  sepolia: '0x17729AFF287d9873F5610c029A5Db814e428e97a',
  'arbitrum-sepolia': '0x51a5cA8966cA71ac0A0D58DbeF2ec6a932e1490E',
}

export const COMPETITOR_TABLE_ADDRESSES: Index = {
  sepolia: '0x9057Fff69e8b016a214C4f894430F71dad50b42c',
  'arbitrum-sepolia': '0x18200Aec1FE277bbA7cA3cBfecF822F099807fFd',
}
export const DISTRIBUTION_TABLE_ADDRESSES: Index = {
  arbitrum: '0xabD8D3693439A72393220d87aee159952261Ad1f',
  sepolia: '0x5217A95F335cd026c877Eb5C1B0Ae6C82945178D',
  'arbitrum-sepolia': '0x9f0496702Df4889C17b7c6Ef88c74ee0dF14998e',
}
export const VOTING_ESCROW_DEPOSITOR_ADDRESSES: Index = {
  arbitrum: '0xBE19a62384014F103686dfE6D9d50B1D3E81B2d0',
  sepolia: '0xe77ede9B472E9AE450a1AcD4A90dcd3fb2e50cD0',
}

export const REVNET_ADDRESSES: Index = {
  sepolia: '0x25bc5d5a708c2e426ef3a5196cc18de6b2d5a3d1',
}

export const DEPRIZE_ID = 2

export const CITIZEN_WHITELIST_ADDRESSES: Index = {
  arbitrum: '0xd594DBF360D666c94615Fb186AF3cB1018Be1616',
  sepolia: '',
  'arbitrum-sepolia': '0x0c7dfCC2B97fAAFD852cEaf62B0CD02BdEa4774A',
}

export const CITIZEN_DISCOUNTLIST_ADDRESSES: Index = {
  arbitrum: '0x755D48e6C3744B723bd0326C57F99A92a3Ca3287',
  sepolia: '',
  'arbitrum-sepolia': '0xef813421ea5e6bc8d8Ad09E08912149C4b115EcB',
}

export const CITIZEN_ROW_CONTROLLER_ADDRESSES: Index = {
  arbitrum: '0xa7879adeFc81884c76342741FbDdE5BfDceAaB36',
  sepolia: '',
  'arbitrum-sepolia': '0x18A0f907575b0387CcFEaa40e694FF1E83Fe5F18',
}

export const TEAM_ADDRESSES: Index = {
  arbitrum: '0xAB2C354eC32880C143e87418f80ACc06334Ff55F',
  sepolia: '0xEb9A6975381468E388C33ebeF4089Be86fe31d78',
  'arbitrum-sepolia': '0xCa3448e91Cf81Ff8E2A25F0128Bd36f2D01C6205',
}

export const TEAM_CREATOR_ADDRESSES: Index = {
  arbitrum: '0x203f481336A212Eff43E84761792E307975Cf27b',
  sepolia: '0x55D07Ab23092edc7EdAEC7048B784aCcb2cc4469',
  'arbitrum-sepolia': '0xC58db82E66803d500A92CeA0fa6DC7Fdb1c6169d',
}

export const TEAM_TABLE_ADDRESSES: Index = {
  arbitrum: '0x434ADaB0BEdFc9973c5cbF0224dfe0212a20d3D4',
  sepolia: '0x42d356e77f6d9Bad870865e0973Ed32F54fA4006',
  'arbitrum-sepolia': '0x7cA858a204eD98E2AD157dfdf3b8Aa8773e90FC5',
}

export const TEAM_TABLE_NAMES: Index = {
  arbitrum: 'TEAMTABLE_42161_92',
  sepolia: 'ENTITYTABLE_11155111_1731',
  'arbitrum-sepolia': 'TEAMTABLE_421614_1069',
}

export const TEAM_WHITELIST_ADDRESSES: Index = {
  arbitrum: '0x203ca831edec28b7657A022b8aFe5d28b6BE6Eda',
  sepolia: '',
  'arbitrum-sepolia': '0x4f269bC8f0984Ee1D0668E3C01d586466aB3535D',
}
export const TEAM_DISCOUNTLIST_ADDRESSES: Index = {
  arbitrum: '0x96E054924258E51d8e3b3aB8A6A27920f6cE53ee',
  sepolia: '',
  'arbitrum-sepolia': '0x7feF5F345B4DaC759B4bb02FaE1a91Dd668260d9',
}

//Citzens & Teams Sepolia Hat Tree : https://app.hatsprotocol.xyz/trees/11155111/386
//Citizens & Teams Arbitrum Hat Tree : https://app.hatsprotocol.xyz/trees/42161/42
export const MOONDAO_HAT_TREE_IDS: Index = {
  arbitrum: '0x0000002a',
  sepolia: '0x00000182',
  'arbitrum-sepolia': '0x00000182',
}

//Projects Sepolia Hat Tree : https://app.hatsprotocol.xyz/trees/11155111/729
//ProjectsArbitrum Hat Tree :
export const PROJECT_HAT_TREE_IDS: Index = {
  arbitrum: '0x00000045',
  sepolia: '0x000002d9',
}

export const JOBS_TABLE_ADDRESSES: Index = {
  arbitrum: '0x94e225DDe1b3E5f861222ca2055739BA12730bd4',
  sepolia: '0x5b26100ae7F244f6805D724A019927E137978659',
  'arbitrum-sepolia': '0x97F9F6DC65b57af7E0B0CB32E5E3153af14E3332',
}

export const MARKETPLACE_ADDRESS =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? polygonConfig.Marketplace
    : sepoliaConfig.Marketplace

export const MARKETPLACE_TABLE_ADDRESSES: Index = {
  arbitrum: '0xEeaa3BfA8E4843b8538D57b5723C2267ecA2c16E',
  sepolia: '0xf50aC858f78ff8d4e5E898C155046bd990dE2cED',
  'arbitrum-sepolia': '0xE632A675C305F0aF36b1514e924BE99DC1AB9884',
}

export const VMOONEY_SWEEPSTAKES: string = ethConfig.vMooneySweepstakesZeroG

export const MARKETPLACE_FEE_SPLIT: string =
  polygonConfig.MarketplaceFeeSplit || ''

export const LMSR_WITH_TWAP_ADDRESSES: Index = {
  sepolia: '0x0087fCc0aF33B00a9AF2f98Eb6788Ffb72bC1C51',
  'arbitrum-sepolia': '0xbd10F66098e123Aa036f7cb1E747e76bbe849eBe',
}
export const CONDITIONAL_TOKEN_ADDRESSES: Index = {
  sepolia: '0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8',
  'arbitrum-sepolia': '0xa0B1b14515C26acb193cb45Be5508A8A46109a27',
}
export const COLLATERAL_TOKEN_ADDRESSES: Index = {
  sepolia: '0x8cfF28F922AeEe80d3a0663e735681469F7374c6',
  'arbitrum-sepolia': '0xA441f20115c868dc66bC1977E1c17D4B9A0189c7',
}
export const COLLATERAL_DECIMALS = 18
export const MAX_OUTCOMES = 3

export const ORACLE_ADDRESS = '0x08B3e694caA2F1fcF8eF71095CED1326f3454B89'

export const OPERATOR_ADDRESS = '0x08B3e694caA2F1fcF8eF71095CED1326f3454B89'

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

export const CK_NEWSLETTER_FORM_ID = '3715552'
export const CK_NETWORK_SIGNUP_FORM_ID = '7238581'
export const CK_NETWORK_SIGNUP_TAG_ID = '5470351'

export const UNIVERSAL_ROUTER_ADDRESSES: Index = {
  ethereum: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  polygon: '0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2',
  sepolia: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  arbitrum: '0x5E325eDA8064b456f4781070C0738d849c824258',
  base: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  'arbitrum-sepolia': '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
  'base-sepolia-testnet': '0x050E797f3625EC8785265e1d9BDd4799b97528A1',
}

export const DISCORD_GUILD_ID = '914720248140279868'
export const GENERAL_CHANNEL_ID = '914720248140279871'
export const TEST_CHANNEL_ID = '1308513773879033886'
export const DISCORD_CITIZEN_ROLE_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? '1293939046774739106' //@Citizen
    : '1331745916117323849' //@CitizenTest

export const HATS_ADDRESS = '0x3bc1A0Ad72417f2d411118085256fC53CBdDd137'

export const HATS_PASSTHROUGH_MODULE_ADDRESS =
  '0x050079a8fbFCE76818C62481BA015b89567D2d35'

export const TABLELAND_ENDPOINT = `https://${
  process.env.NEXT_PUBLIC_CHAIN != 'mainnet' ? 'testnets.' : ''
}tableland.network/api/v1/query`

export const CHAIN_TOKEN_NAMES: Index = {
  ethereum: 'ETH',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  sepolia: 'ETH',
}

export const ARBITRUM_ASSETS_URL =
  'https://safe-client.safe.global/v1/chains/42161/safes/0xAF26a002d716508b7e375f1f620338442F5470c0/balances/usd?trusted=true'
export const POLYGON_ASSETS_URL =
  'https://safe-client.safe.global/v1/chains/137/safes/0x8C0252c3232A2c7379DDC2E44214697ae8fF097a/balances/usd?trusted=true'
export const BASE_ASSETS_URL =
  'https://safe-client.safe.global/v1/chains/8453/safes/0x871e232Eb935E54Eb90B812cf6fe0934D45e7354/balances/usd?trusted=true'
