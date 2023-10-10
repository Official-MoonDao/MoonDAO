import {
  HomeIcon,
  LockClosedIcon,
  RocketLaunchIcon,
  BellIcon,
  ChartBarSquareIcon,
  FolderIcon,
  CalendarDaysIcon,
  WalletIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'

export const navigation = [
  {
    name: 'home',
    href: '/',
    icon: HomeIcon,
  },
  {
    name: 'Onboarding',
    href: '/onboarding',
    icon: PlusIcon,
  },
  {
    name: 'Buy $MOONEY',
    href: 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
    icon: WalletIcon,
    external: true,
  },
  {
    name: 'lockTokens',
    href: '/lock',
    icon: LockClosedIcon,
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
      { name: 'Zero Gravity', href: '/zero-g' },
      { name: 'Moon Mission', href: '/lifeship' },
    ],
  },
]
