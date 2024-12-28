import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'

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

export const DEFAULT_CHAIN =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia

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
}

export const CITIZEN_TABLE_ADDRESSES: Index = {
  arbitrum: '0x8F14E436fa0fFcD4239733686d190F1e4F1b84E6',
  sepolia: '0x369E322EC264dB091ef30032f3ac9B5Da628FE50',
}

export const CITIZEN_TABLE_NAMES: Index = {
  arbitrum: 'CITIZENTABLE_42161_98',
  sepolia: 'CITIZENTABLE_11155111_1671',
}

export const PROJECT_TABLE_ADDRESSES: Index = {
  arbitrum: '0x4c2d6567D81A34117E894b6fDC97C9824f80D961',
  'arbitrum-sepolia': '0xF0A3DB6161D1Ee7B99197CDeD4EdFc462EAE80e0',
}
export const COMPETITOR_TABLE_ADDRESSES: Index = {
  sepolia: '0x9057Fff69e8b016a214C4f894430F71dad50b42c',
}
export const DISTRIBUTION_TABLE_ADDRESSES: Index = {
  arbitrum: '0xabD8D3693439A72393220d87aee159952261Ad1f',
  'arbitrum-sepolia': '0xd1D57F18252D06a6b28DE96B6cbF7F4283A4F205',
}
export const VOTING_ESCROW_DEPOSITOR_ADDRESSES: Index = {
  arbitrum: '0xBE19a62384014F103686dfE6D9d50B1D3E81B2d0',
  sepolia: '0xe77ede9B472E9AE450a1AcD4A90dcd3fb2e50cD0',
}

export const REVNET_ADDRESSES: Index = {
  sepolia: '0x25bc5d5a708c2e426ef3a5196cc18de6b2d5a3d1',
}

export const DEPRIZE_ID = 1

export const CITIZEN_WHITELIST_ADDRESSES: Index = {
  arbitrum: '0xd594DBF360D666c94615Fb186AF3cB1018Be1616',
  sepolia: '',
}

export const CITIZEN_DISCOUNTLIST_ADDRESSES: Index = {
  arbitrum: '0x755D48e6C3744B723bd0326C57F99A92a3Ca3287',
  sepolia: '',
}

export const CITIZEN_ROW_CONTROLLER_ADDRESSES: Index = {
  arbitrum: '0xa7879adeFc81884c76342741FbDdE5BfDceAaB36',
  sepolia: '',
}

export const TEAM_ADDRESSES: Index = {
  arbitrum: '0xAB2C354eC32880C143e87418f80ACc06334Ff55F',
  sepolia: '0xEb9A6975381468E388C33ebeF4089Be86fe31d78',
}

export const TEAM_CREATOR_ADDRESSES: Index = {
  arbitrum: '0x203f481336A212Eff43E84761792E307975Cf27b',
  sepolia: '0x55D07Ab23092edc7EdAEC7048B784aCcb2cc4469',
}

export const TEAM_TABLE_ADDRESSES: Index = {
  arbitrum: '0x434ADaB0BEdFc9973c5cbF0224dfe0212a20d3D4',
  sepolia: '0x42d356e77f6d9Bad870865e0973Ed32F54fA4006',
}

export const TEAM_TABLE_NAMES: Index = {
  arbitrum: 'TEAMTABLE_42161_92',
  sepolia: 'ENTITYTABLE_11155111_1731',
}

export const TEAM_WHITELIST_ADDRESSES: Index = {
  arbitrum: '0x203ca831edec28b7657A022b8aFe5d28b6BE6Eda',
  sepolia: '',
}
export const TEAM_DISCOUNTLIST_ADDRESSES: Index = {
  arbitrum: '0x96E054924258E51d8e3b3aB8A6A27920f6cE53ee',
  sepolia: '',
}

export const MOONDAO_HAT_TREE_IDS: Index = {
  arbitrum: '0x0000002a',
  sepolia: '0x00000182',
}

export const JOBS_TABLE_ADDRESSES: Index = {
  arbitrum: '0x94e225DDe1b3E5f861222ca2055739BA12730bd4',
  sepolia: '0x5b26100ae7F244f6805D724A019927E137978659',
}

export const MARKETPLACE_ADDRESS =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? polygonConfig.Marketplace
    : sepoliaConfig.Marketplace

export const MARKETPLACE_TABLE_ADDRESSES: Index = {
  arbitrum: '0xEeaa3BfA8E4843b8538D57b5723C2267ecA2c16E',
  sepolia: '0xf50aC858f78ff8d4e5E898C155046bd990dE2cED',
}

export const VMOONEY_SWEEPSTAKES: string = ethConfig.vMooneySweepstakesZeroG

export const MARKETPLACE_FEE_SPLIT: string =
  polygonConfig.MarketplaceFeeSplit || ''

export const LMSR_ADDRESSES: Index = {
  sepolia: '0xCDb2D4d1B02AA041a7dB61159f2080cbfBB37671',
  //sepolia: '0xBB335Fe1BcE1a1d42b23c40D1735f9255B10819b',
  'arbitrum-sepolia': '0x789fc04493F3c1E3D853E164e767915109814B27',
}
export const LMSR_WITH_TWAP_ADDRESSES: Index = {
  sepolia: '0xB5B364c62Fb77BBf001F6d0cD70d0D72bDFa4Ff2',
}

export const CONDITIONAL_TOKEN_ADDRESSES: Index = {
  sepolia: '0x57f1e9424150Ea78977d479815fD26B05D8EbB0e',
  'arbitrum-sepolia': '0xF537d6d5438A7307a8aA5670Ec3fb27b5BD208f0',
}
export const COLLATERAL_TOKEN_ADDRESSES: Index = {
  sepolia: '0xF85601CA802be17118618b2f61EF84433c0eb5D7',
  'arbitrum-sepolia': '0xA441f20115c868dc66bC1977E1c17D4B9A0189c7',
}
export const COLLATERAL_DECIMALS = 18
export const MAX_OUTCOMES = 8

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

export const SNAPSHOT_RETROACTIVE_REWARDS_ID =
  '0xeb8080c307faf35ecab2910831de90aeddd0711aa5090af74f99214b96484f57'
