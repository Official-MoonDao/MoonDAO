import {
  HomeIcon,
  LockClosedIcon,
  RocketLaunchIcon,
  BellIcon,
  ChartBarSquareIcon,
  FolderIcon,
  CalendarDaysIcon,
  WalletIcon,
} from '@heroicons/react/24/outline'

export const navigation = [
  {
    name: 'home',
    href: '/',
    icon: HomeIcon,
  },
  {
    name: 'Buy Mooney',
    href: 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
    icon: WalletIcon,
  },
  {
    name: 'lockTokens',
    href: '/lock',
    icon: LockClosedIcon,
  },
  {
    name: 'Announcements',
    href: '/announcements',
    icon: BellIcon,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: ChartBarSquareIcon,
  },
  {
    name: 'Calendar',
    href: '/calendar',
    icon: CalendarDaysIcon,
  },
  {
    name: 'Missions',
    icon: RocketLaunchIcon,
    children: [
      { name: 'Zero-g', href: '/zero-g' },
      { name: 'Lifeship', href: '/lifeship' },
    ],
  },
]
