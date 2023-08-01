import {
  HomeIcon,
  HomeModernIcon,
  BellIcon,
  WalletIcon,
  LockClosedIcon,
  TableCellsIcon,
  ChartPieIcon,
  RocketLaunchIcon,
  CalendarDaysIcon,
  FolderIcon,
} from '@heroicons/react/24/outline'

export const navigation = [
  {
    name: 'home',
    href: '/',
    icon: HomeIcon,
  },
  {
    name: 'lockTokens',
    href: '/lock',
    icon: LockClosedIcon,
  },
  {
    name: 'Dashboard',
    icon: TableCellsIcon,
    children: [
      { name: 'Annoucements', href: '/dashboard/announcements' },
      { name: 'Proposals', href: '/dashboard/proposals' },
      { name: 'Treasury', href: '/dashboard/treasury' },
      { name: 'Analytics', href: '/dashboard/analytics' },
      { name: 'Calendar', href: '/dashboard/calendar' },
    ],
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
