import {
  BuildingLibraryIcon,
  FolderIcon,
  HomeIcon,
  PlusIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline'

export const navigation = [
  {
    name: 'Welcome',
    href: '/',
    icon: HomeIcon,
  },
  {
    name: 'Join MoonDAO',
    href: '/join',
    icon: PlusIcon,
  },
  {
    name: 'Governance',
    icon: BuildingLibraryIcon,
    children: [
      {
        name: 'Get $MOONEY',
        href: 'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
      },
      { name: 'Lock $MOONEY', href: '/lock' },
      {
        name: 'Constitution',
        href: 'https://publish.obsidian.md/moondao/MoonDAO/docs/Constitution',
      },
      {
        name: 'Vote on Proposals',
        href: 'https://publish.obsidian.md/moondao/MoonDAO/docs/Constitution',
      },
      {
        name: 'Submit Proposal',
        href: 'https://discord.com/channels/914720248140279868/1027658256706961509',
      },
      { name: 'More...', href: '/governance' },
    ],
  },
  {
    name: 'Marketplace',
    icon: RocketLaunchIcon,
    children: [
      { name: 'Sweepstakes 🚀', href: '/sweepstakes' },
      { name: 'ZeroG', href: '/zero-g' },
      { name: 'Lifeship', href: '/lifeship' },
      {
        name: 'MoonDAO Shields',
        href: '/marketplace/collection/0xE71f58663f80b61f5D127D9DE9d554ca66dED5f1',
        dynamicHref: '/marketplace/collection/[contractAddress]',
      },
    ],
  },
  {
    name: 'Links',
    icon: FolderIcon,
    children: [
      { name: 'Snapshot', href: 'https://snapshot.org/#/tomoondao.eth' },
      { name: 'Documentation', href: 'https://moondao.com/docs/introduction' },
      { name: 'Newsletter', href: 'https://moondao.ck.page/profile' },
      { name: 'Events', href: '/events' },
      { name: 'Analytics', href: '/analytics' },
    ],
  },
]
