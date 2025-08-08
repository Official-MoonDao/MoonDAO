import {
  BuildingLibraryIcon,
  BuildingStorefrontIcon,
  CircleStackIcon,
  ClipboardDocumentListIcon,
  DocumentIcon,
  FolderIcon,
  PlusIcon,
  RocketLaunchIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { useMemo } from 'react'
import IconOrg from '@/components/assets/IconOrg'

export default function useNavigation(citizen: any) {
  return useMemo(() => {
    return [
      !citizen && {
        name: 'Join',
        href: '/join',
        icon: PlusIcon,
      },
      {
        name: 'Network',
        href: '/network',
        icon: IconOrg,
        children: [
          { name: 'Network Overview', href: '/network' },
          { name: 'Become a Citizen', href: '/join' },
          { name: 'Create a Team', href: '/team' },
          {
            name: 'Submit Contribution',
            href: '/contributions',
          },
          {
            name: 'Jobs',
            href: '/jobs',
          },
        ],
      },
      {
        name: 'Govern',
        icon: BuildingLibraryIcon,
        href: '/governance',
        children: [
          {
            name: 'Governance Overview',
            href: '/governance',
          },
          {
            name: 'Proposals',
            href: '/vote',
          },
          {
            name: 'Constitution',
            href: '/constitution',
          },
        ],
      },
      {
        name: '$MOONEY',
        icon: CircleStackIcon,
        href: '/mooney',
        children: [
          {
            name: 'Buy',
            href: '/mooney',
          },
          { name: 'Lock', href: '/lock' },
          { name: 'Bridge', href: '/bridge' },
        ],
      },
      {
        name: 'Projects',
        icon: WrenchScrewdriverIcon,
        href: '/projects-overview',
        children: [
          {
            name: 'Projects Overview',
            href: '/projects-overview',
          },
          {
            name: 'Project Rewards',
            href: '/projects',
          },
          {
            name: 'Propose Project',
            href: '/proposals',
          },
        ],
      },
      {
        name: 'Learn',
        icon: FolderIcon,
        href: '/info',
        children: [
          { name: 'News', href: '/news' },
          { name: 'About', href: '/about' },
          { name: 'Events', href: '/events' },
          { name: 'Analytics', href: '/analytics' },
          { name: 'FAQ', href: '/faq' },
        ],
      },
      {
        name: 'Marketplace',

        icon: BuildingStorefrontIcon,
        href: '/marketplace',
      },
      process.env.NEXT_PUBLIC_CHAIN === 'testnet' && {
        name: 'Launchpad',
        icon: RocketLaunchIcon,
        href: '/launch',
      },
    ]
  }, [citizen])
}
