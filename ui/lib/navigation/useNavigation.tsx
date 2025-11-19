import {
  CircleStackIcon,
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
        name: 'Citizenship',
        href: '/network',
        icon: IconOrg,
        children: [
          { name: 'Become a Citizen', href: '/citizen' },
          { name: 'Create a Team', href: '/team' },
          { name: 'Explore Citizens', href: '/network' },
          {
            name: 'Jobs',
            href: '/jobs',
          },
          {
            name: 'Marketplace',
            href: '/marketplace',
          },
        ],
      },
      {
        name: '$MOONEY',
        icon: CircleStackIcon,
        href: '/mooney',
        children: [
          {
            name: 'Get $MOONEY',
            href: '/mooney',
          },
          { name: 'Lock $MOONEY', href: '/lock' },
          { name: 'Bridge $MOONEY', href: '/bridge' },
        ],
      },
      {
        name: 'Projects',
        icon: WrenchScrewdriverIcon,
        href: '/projects-overview',
        children: [
          {
            name: 'Propose Project',
            href: '/proposals',
          },
          {
            name: 'Projects',
            href: '/projects-overview',
          },
          {
            name: 'Proposals',
            href: '/vote',
          },
          {
            name: 'Submit Contribution',
            href: '/contributions',
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
          { name: 'Resources', href: '/resources' },
          { name: 'Constitution', href: '/constitution' },
          { name: 'Network Overview', href: '/join' },
          { name: 'Token Overview', href: '/mooney' },
          { name: 'Governance Overview', href: '/governance' },
          { name: 'Projects Overview', href: '/projects-overview' },
        ],
      },
      {
        name: 'Launchpad',
        icon: RocketLaunchIcon,
        href: '/launch',
      },
    ]
  }, [citizen])
}
