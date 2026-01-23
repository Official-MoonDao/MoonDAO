import { utils } from 'ethers'

// Use https://csvjson.com with the humanFormat output to get json
const payouts = [
  {
    username: 'anastasiaadastra',
    address: '0x529bd2351476ba114f9d60e71a020a9f0b99f047',
    vMOONEY: 266307.67,
    ETH: 0.4649,
  },
  {
    username: 'vartzzzz',
    address: '0x08cb6bdf2f905c86beb529eedbb960e840397972',
    vMOONEY: 1747526.39,
    ETH: 3.0507,
  },
  {
    username: 'ionrod',
    address: '0xa64f2228ccec96076c82abb903021c33859082f8',
    vMOONEY: 658593.63,
    ETH: 0.6497,
  },
  {
    username: 'alexa',
    address: '0xf9b86a59375617e1e8a548e3ed82742e658fe7fc',
    vMOONEY: 209552.52,
    ETH: 0,
  },
  {
    username: 'rinafaber',
    address: '0x47cc4c7fef42187f9f7901838f316b033e92be05',
    vMOONEY: 538849.33,
    ETH: 0.4407,
  },
  {
    username: 'roykahangwe',
    address: '0x00127f44bad82b9ea27245a14a4141e5ef0161a8',
    vMOONEY: 89808.22,
    ETH: 0,
  },
  {
    username: 'frank041099',
    address: '0xf2befa4b9489c1ef75e069d16a6f829f71b4b988',
    vMOONEY: 747982.48,
    ETH: 0,
  },
  {
    username: 'Mary Liz',
    address: '0xdAe44f2b119f1b975d001C51E928B375383a6728',
    vMOONEY: 747982.48,
    ETH: 1.3058,
  },
  {
    username: 'pmoncada',
    address: '0x679d87d8640e66778c3419d164998e720d7495f6',
    vMOONEY: 0,
    ETH: 0,
  },
  {
    username: 'ryan',
    address: '0xb2d3900807094d4fe47405871b0c8adb58e10d42',
    vMOONEY: 0,
    ETH: 0,
  },
  {
    username: 'jaderiverstokes',
    address: '0x08b3e694caa2f1fcf8ef71095ced1326f3454b89',
    vMOONEY: 0,
    ETH: 0,
  },
  {
    username: 'name.get',
    address: '0x80581c6e88ce00095f85cdf24bb760f16d6ec0d6',
    vMOONEY: 0,
    ETH: 0,
  },
  {
    username: '.moguel.',
    address: '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da',
    vMOONEY: 0,
    ETH: 0,
  },
  {
    username: 'alexlayendecker_54332',
    address: '0xb87b8c495d3dae468d4351621b69d2ec10e656fe',
    vMOONEY: 879686.26,
    ETH: 1.5357,
  },
  {
    username: 'dreimanj',
    address: '0xe2d3ac725e6ffe2b28a9ed83bedaaf6672f2c801',
    vMOONEY: 84296.17,
    ETH: 0.1472,
  },
  {
    username: 'moonshot_30124',
    address: '0x7f79a7aaf569f350806813d41aeba544cbd017f4',
    vMOONEY: 106180.76,
    ETH: 0.1854,
  },
  {
    username: 'astroeliza',
    address: '0x08e424b69851b7b210ba3e5e4233ca6fcc1adedb',
    vMOONEY: 80648.74,
    ETH: 0.1408,
  },
  {
    username: 'social_hacker_38241',
    address: '0x04877685e94e0694944d08a43d021e5768b595f0',
    vMOONEY: 83485.63,
    ETH: 0.1457,
  },
  {
    username: 'astronautgio',
    address: '0x79d0b453dd5d694da4685fbb94798335d5f77760',
    vMOONEY: 53900.92,
    ETH: 0.0941,
  },
  {
    username: 'alexey_petrov.',
    address: '0xf8b8dbd8f51378d58554a1da8cd3d8241a8cb6d3',
    vMOONEY: 74569.69,
    ETH: 0.1302,
  },
  {
    username: 'luciaferreira2024',
    address: '0x665e17970455ea7137162274be840c7807d54ef2',
    vMOONEY: 102938.6,
    ETH: 0.1797,
  },
  {
    username: 'simsimphony',
    address: '0x28fef44120d5ba4d3b4ad627fdfa8bd5a8240f8f',
    vMOONEY: 47416.6,
    ETH: 0.0828,
  },
  {
    username: 'wonderofme',
    address: '0x1bdae6ada43e9f30f33896ac5222b3886c7fc1a2',
    vMOONEY: 65248.48,
    ETH: 0.1139,
  },
  {
    username: '',
    address: '0xeab34514c3be19dde81419c32afcd8a671c35a13',
    vMOONEY: 21479.31,
    ETH: 0.0375,
  },
  {
    username: '',
    address: '0xa2e7af6fc66e5292345a666027d75b6a18779154',
    vMOONEY: 18237.15,
    ETH: 0.0318,
  },
]

const vMooneyAddresses = payouts.map((payout) => payout.address).join(',')
const vMooneyAmounts = payouts
  .filter((payout) => payout.vMOONEY !== 0)
  .map((payout) => payout.vMOONEY)
  .map((mooney) => {
    if (!mooney || mooney === 0) {
      return '0x0'
    }
    return `${utils.parseUnits(mooney.toString(), 18).toHexString()}`
  })
  .join(',')
const totalVMOONEY = payouts.reduce((sum, payout) => payout.vMOONEY + sum, 0)
console.log('totalVMOONEY', totalVMOONEY)
console.log('vMooneyAddresses', vMooneyAddresses)
console.log('vMooneyAmounts', vMooneyAmounts)
const ethPayoutCSV =
  'token_type,token_address,receiver,amount,id\n' +
  payouts
    .filter((payout) => payout.ETH !== 0)
    .map((payout) => `native,,${payout.address},${payout.ETH},`)
    .join('\n')
console.log('ethPayoutCSV\n', ethPayoutCSV)
