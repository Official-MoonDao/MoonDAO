import {
  BuildingLibraryIcon,
  ClipboardDocumentListIcon,
  FolderIcon,
  PlusIcon,
  RocketLaunchIcon,
  WrenchScrewdriverIcon, 
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
    children: [
      { name: 'Teams', href: '/teams' },
      { name: 'Citizens', href: '/citizens' },
      { name: 'Map', href: '/map' },
    ]
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
        name: 'Get $MOONEY',
        href: '/get-mooney',
      },
      { name: 'Get Voting Power', href: '/lock' },
    ],
  },
  {
    name: 'Contribute',
    icon: WrenchScrewdriverIcon,
    href: '/submit',
    children: [
      {
        name: 'Submit Proposal',
        href: '/submit',
      },
      {
        name: 'Submit Contribution',
        href: '/contribute',
      },
    ],
  },
  {
    name: 'Marketplace',
    icon: RocketLaunchIcon,
    href: '/marketplace',
  },
  {
    name: 'Jobs',
    href: '/jobs',
    icon: ClipboardDocumentListIcon,
  },
]
