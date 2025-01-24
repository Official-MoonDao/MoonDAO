export function getBudget(tokens: any, year: number, quarter: number) {
  const numQuartersPastQ4Y2022 = (year - 2022 - 1) * 4 + quarter
  let ethBudget = 0
  let usdValue = 0
  let usdBudget = 0
  let mooneyBudget = 0
  let ethPrice = 0
  if (tokens && tokens[0]) {
    for (const token of tokens) {
      if (token.symbol !== 'MOONEY') {
        usdValue += token.usd
      }
    }
    //console.log('usdValue', usdValue)
    ethPrice = tokens[0].usd / tokens[0].balance
    const ethValue = usdValue / ethPrice
    usdBudget = usdValue * 0.05
    ethBudget = ethValue * 0.05
    const MOONEY_INITIAL_BUDGET = 15_000_000
    const MOONEY_DECAY_RATE = 0.95
    ethBudget = 14.5896

    mooneyBudget =
      MOONEY_INITIAL_BUDGET * MOONEY_DECAY_RATE ** numQuartersPastQ4Y2022
  }
  return {
    ethBudget,
    usdBudget,
    mooneyBudget,
    ethPrice,
    usdValue,
  }
}

export function getPayouts(
  projectIdToEstimatedPercentage: any,
  projects: any,
  ethBudget: number,
  mooneyBudget: number
) {
  const projectIdToETHPayout: { [key: string]: number } = {}
  const projectIdToMooneyPayout: { [key: string]: number } = {}
  for (const project of projects) {
    const percentage = projectIdToEstimatedPercentage[project.id]
    projectIdToETHPayout[project.id] = (percentage / 100) * ethBudget
    projectIdToMooneyPayout[project.id] = (percentage / 100) * mooneyBudget
  }
  const addressToEthPayout: { [key: string]: number } = {}
  const addressToMooneyPayout: { [key: string]: number } = {}
  for (const project of projects) {
    const projectId = project.id
    const projectPercentage = projectIdToEstimatedPercentage[projectId]
    const rewardDistributionString = project.rewardDistribution || '{}'
    const fixedRewardDistribution = rewardDistributionString.replace(
      /(\b0x[a-fA-F0-9]{40}\b):/g,
      '"$1":'
    )
    const upfrontPayments: { [key: string]: number } = project.upfrontPayments

    const contributors: { [key: string]: number } = JSON.parse(
      fixedRewardDistribution
    )
    for (const [contributerAddress, contributorPercentage] of Object.entries(
      contributors
    )) {
      const marginalPayoutProportion =
        (contributorPercentage / 100) * (projectPercentage / 100)
      if (!(contributerAddress in addressToEthPayout)) {
        addressToEthPayout[contributerAddress] = 0
      }
      if (!(contributerAddress in addressToMooneyPayout)) {
        addressToMooneyPayout[contributerAddress] = 0
      }
      addressToMooneyPayout[contributerAddress] +=
        marginalPayoutProportion * mooneyBudget

      if (
        upfrontPayments &&
        contributerAddress in upfrontPayments &&
        upfrontPayments[contributerAddress] >
          marginalPayoutProportion * ethBudget
      ) {
        continue
      }
      addressToEthPayout[contributerAddress] +=
        marginalPayoutProportion * ethBudget
    }
  }

  const communityCircle = {
    '0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801': 4.69,
    '0x08B3e694caA2F1fcF8eF71095CED1326f3454B89': 0.78,
    '0x86c779b3741e83A36A2a236780d436E4EC673Af4': 1.43,
    '0x25910143C255828F623786f46fe9A8941B7983bB': 10.17,
    '0xAfcB3224774297Cb67d20aF99eB2ccf80E9F51Ca': 0.26,
    '0x4CBf10c36b481d6afF063070E35b4F42E7Aad201': 8.6,
    '0x7F630377aBDB1423C3001a45b21909C93af607Bb': 0.13,
    '0x6dFd4a0a88832D88532167F83F796FbeD4752e55': 0.39,
    '0x08E424b69851b7b210bA3E5E4233Ca6fcc1ADEdb': 15.51,
    '0x9A1741b58Bd99EBbc4e9742Bd081b887DfC95f53': 1.96,
    '0x2eB09037DE144D7bDF2aF06130DEF727a239F8CD': 12.52,
    '0xa1D84CD4Ab2e106B8114842b6B902E9462A73BAd': 5.08,
    '0xA116C6903eD7295C75187f555F86A6bb9CC9F93f': 4.04,
    '0x6bFd9e435cF6194c967094959626ddFF4473a836': 4.04,
    '0x79D0B453Dd5d694da4685Fbb94798335D5F77760': 3.78,
    '0x730C114a2557EC551B6098593FA15D66d5593873': 3.52,
    '0x04877685e94e0694944d08a43d021e5768b595f0': 3.39,
    '0x0d89421d6eec0a4385f95f410732186a2ab45077': 3.13,
    '0xa64f2228ccec96076c82abb903021c33859082f8': 2.35,
    '0x977e3f778d1afce209fa0d2299374b1875f5238a': 2.22,
    '0xa829cfd0a0ba3ef42561b9276147c25382aeb801': 2.22,
    '0x015d7d1345061859e7b5750cb310b1edeb777c96': 1.43,
    '0x8f8c0cc482a24124123ccb95600781fcefeb09f8': 1.43,
    '0x6933cfd1469ba1a0ec44c7d7311cb153d949381d': 0.78,
    '0x344742b8ae4fd24163fd3f80a229310624a467db': 0.78,
    '0x3e7ee482bc9b69a70b1f570e9b08ab8ba6c646ed': 0.65,
    '0x961d4191965c49537c88f764d88318872ce405be': 0.39,
    '0x0bfc29af6c23cadd46149d0b94dffaf163aa0b1b': 0.26,
    '0x5985062af881373d5429a99e389f83697aa217e5': 0.26,
    '0x99abd1e20b9497d505285fe1f926f2e988ee29d1': 0.26,
    '0xa9011c4cfd1207eb2735f8fa67a65baf4f24fcad': 0.26,
    '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988': 0.26,
    '0x529bd2351476ba114f9d60e71a020a9f0b99f047': 0.13,
    '0x59041d70deaefe849a48e77e0b273ddd072ea9e4': 0.13,
    '0xf85dbc31d0c7bd46eb9ec684a64d97e41ab04ce3': 0.13,
    '0x214a0c6ddd9bd4415a1d4db542d32340112155b7': 0.13,
    '0x9adf3e07eff4305bbbfb6d2c4ba26a7f74e00abf': 0.13,
    '0x1a1e25bca28dca769cb29df860d18e093cc894ae': 0.13,
    '0x4911503fcf75ecb454ded9e4677e16a185569e25': 0.13,
    '0x13f586fda99dc0e60bf7168c34957dcae63c685d': 0.13,
    '0xd02cc637ab0dcd26f54a50e58ba1ec6fbbdb1dcd': 0.13,
    '0xb2f98dd25d796c68be7be88ef5dfa8818ce79b61': 0.13,
    '0x24b636ed4a90a45a854a980bf4199d1adc44fdcd': 0.13,
    '0x8c1f3ea7c75b9100353a0f2adc961c3fb8d718b3': 0.13,
    '0x95593cbbcc29239e02178d7b3272a83eab26a046': 0.13,
    '0x349c5131caf1113d63c1b85804611d99d754403d': 0.13,
    '0x774c03bc1b397c49e503485093d68f8b76bbf928': 0.13,
    '0xfb4134d449cf601163de8cd032f473012ba5f584': 0.13,
    '0x47cc4c7fef42187f9f7901838f316b033e92be05': 0.13,
    '0x30dd2fb997c7d66a54598897b6081f022e8eef21': 0.13,
    '0x809c9f8dd8ca93a41c3adca4972fa234c28f7714': 0.13,
    '0x31a5c02588c6d021f3ef377039b38ca2ba10c960': 0.13,
    '0x22dd6a75f1b35f2716fedcb7de32842a292bb08b': 0.13,
    '0x1de190109da0d100dd516ee13c8695c0b4e4c75d': 0.13,
    '0x5890d5c2d8727dd9084e422797d7a01af8630ad9': 0.13,
  }
  const COMMUNITY_CIRCLE_PERCENTAGE = 10
  for (const [contributerAddress, contributorPercentage] of Object.entries(
    communityCircle
  )) {
    if (!(contributerAddress in addressToEthPayout)) {
      addressToEthPayout[contributerAddress] = 0
    }
    if (!(contributerAddress in addressToMooneyPayout)) {
      addressToMooneyPayout[contributerAddress] = 0
    }
    const marginalPayoutProportion =
      (COMMUNITY_CIRCLE_PERCENTAGE / 100) * (contributorPercentage / 100)
    addressToMooneyPayout[contributerAddress] +=
      marginalPayoutProportion * mooneyBudget
    addressToEthPayout[contributerAddress] +=
      marginalPayoutProportion * ethBudget
  }

  const addressToPayoutProportion: { [key: string]: number } = {}
  for (const [address, mooneyPayout] of Object.entries(addressToMooneyPayout)) {
    addressToPayoutProportion[address] = mooneyPayout / mooneyBudget
  }
  const ethPayoutCSV = Object.entries(addressToEthPayout)
    .map(([address, eth]) => `${address},${eth}`)
    .join('\n')

  const vMooneyAddresses = Object.keys(addressToMooneyPayout).join(',')
  let result = []
  for (const [address, mooney] of Object.entries(addressToMooneyPayout)) {
    result.push(`"0x${(mooney * 10 ** 18).toString(16)}"`)
  }
  const vMooneyAmounts = result.join(',')
  //console.log('vMooneyAddresses')
  //console.log(vMooneyAddresses)
  //console.log('vMooneyAmounts')
  //console.log(vMooneyAmounts)

  return {
    projectIdToETHPayout,
    projectIdToMooneyPayout,
    addressToEthPayout,
    addressToMooneyPayout,
    ethPayoutCSV,
  }
}
