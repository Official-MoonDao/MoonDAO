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
    href: '/governance',
    icon: BuildingLibraryIcon,
  },
  {
    name: 'Marketplace',
    icon: RocketLaunchIcon,
    children: [
      { name: 'Sweepstakes 🚀', href: '/sweepstakes' },
      { name: 'ZeroG', href: '/zero-g' },
      { name: 'Lifeship', href: '/lifeship' },
      { name: 'Digital Assets', href: '/marketplace' },
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
