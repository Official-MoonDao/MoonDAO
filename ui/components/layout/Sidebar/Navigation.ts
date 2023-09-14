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
