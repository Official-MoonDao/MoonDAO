import {
  HomeIcon,
  LockClosedIcon,
  RocketLaunchIcon,
  BellIcon,
  ChartBarSquareIcon,
  FolderIcon,
  CalendarDaysIcon,
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
    name: 'Announcements',
    href: '/dashboard/announcements',
    icon: BellIcon,
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: ChartBarSquareIcon,
  },
  {
    name: 'Proposals',
    href: '/dashboard/proposals',
    icon: FolderIcon,
  },
  {
    name: 'Calendar',
    href: '/dashboard/calendar',
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
