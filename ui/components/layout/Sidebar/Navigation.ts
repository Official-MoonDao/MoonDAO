import {
  HomeIcon,
  LockClosedIcon,
  BuildingLibraryIcon,
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
    name: 'Governance',
    href: '/governance',
    icon: BuildingLibraryIcon,
  },
  {
    name: 'Missions',
    icon: RocketLaunchIcon,
    children: [
      { name: 'Zero Gravity', href: '/zero-g' },
      { name: 'Moon Mission', href: '/lifeship' },
      { name: 'Ticket to Space', href: '/ticket2space' },
    ],
  },
]
