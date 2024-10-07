import {
  BuildingLibraryIcon,
  ClipboardDocumentListIcon,
  FolderIcon,
  PlusIcon,
  RocketLaunchIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import IconOrg from '../../assets/IconOrg'

export const navigation = [
  {
    name: 'Join',
    href: '/join',
    icon: PlusIcon,
    children: [
      { name: 'Become a Citizen', href: '/citizen' },
      { name: 'Create a Team', href: '/team' },
    ],
  },
  {
    name: 'Network',
    href: '/network',
    icon: IconOrg,
  },
  {
    name: 'Info',
    icon: FolderIcon,
    href: '/info',
    children: [
      { name: 'News', href: '/news' },
      { name: 'About', href: '/about' },
      {
        name: 'Constitution',
        href: 'https://docs.moondao.com/Governance/Constitution',
      },
      { name: 'Events', href: '/events' },
      { name: 'Analytics', href: '/analytics' },
    ],
  },
  {
    name: 'Governance',
    icon: BuildingLibraryIcon,
    href: '/governance',
    children: [
      {
        name: 'All Proposals',
        href: '/vote',
      },
      {
        name: 'Submit Proposal',
        href: '/propose',
      },
      {
        name: 'Get $MOONEY',
        href: '/get-mooney',
      },
      { name: 'Get Voting Power', href: '/lock' },
      {name:'Bridge', href:'/bridge'}
    ],
  },
  {
    name: 'Marketplace',
    icon: RocketLaunchIcon,
    href: '/marketplace',
    children: [
      { name: 'Ticket to Space 🚀', href: '/sweepstakes' },
      { name: 'Zero Gravity', href: '/zero-gravity' },
      { name: 'LifeShip', href: '/lifeship' },
      // {
      //   name: 'MoonDAO Shields',
      //   href: '/marketplace/collection/0xE71f58663f80b61f5D127D9DE9d554ca66dED5f1',
      //   dynamicHref: '/marketplace/collection/[contractAddress]',
      // },
    ],
  },
  {
    name: 'Jobs',
    href: '/jobs',
    icon: ClipboardDocumentListIcon,
  },
]
