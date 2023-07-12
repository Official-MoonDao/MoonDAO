import {
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
    icon: TableCellsIcon,
  },
  {
    name: 'lockTokens',
    href: '/lock',
    icon: LockClosedIcon,
  },
  {
    name: 'zero-g',
    href: '/zero-g',
    icon: RocketLaunchIcon,
  },
  {
    name: 'Lifeship',
    href: '/lifeship',
    icon: RocketLaunchIcon,
  },
  {
    name: 'Announcements',
    href: '/lifeship',
    icon: BellIcon,
  },
  {
    name: 'Proposals',
    href: '/lifeship',
    icon: FolderIcon,
  },
  {
    name: 'Treasury',
    href: '/lifeship',
    icon: WalletIcon,
  },
  {
    name: 'Analytics',
    href: '/lifeship',
    icon: ChartPieIcon,
  },
  {
    name: 'Calendar',
    href: '/lifeship',
    icon: CalendarDaysIcon,
  },
]
