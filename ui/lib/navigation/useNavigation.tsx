import {
  BuildingLibraryIcon,
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
  const navigation = useMemo(() => {
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
          { name: 'Citizens', href: '/network?tab=citizens' },
          { name: 'Teams', href: '/network?tab=teams' },
          { name: 'Map', href: '/map' },
          { name: 'Create a Team', href: '/team' },
        ],
      },
      {
        name: 'Govern',
        icon: BuildingLibraryIcon,
        href: '/governance',
        children: [
          {
            name: 'Proposals',
            href: '/vote',
          },
          {
            name: 'Constitution',
            href: 'https://docs.moondao.com/Governance/Constitution',
          },
          {
            name: '$MOONEY Token',
          },
          {
            name: 'Buy',
            href: '/get-mooney',
          },
          { name: 'Lock', href: '/lock' },
          { name: 'Bridge', href: '/bridge' },
        ],
      },
      {
        name: 'Contribute',
        icon: WrenchScrewdriverIcon,
        href: '/submit',
        children: [
          {
            name: 'Projects',
            href: '/projects',
          },
          {
            name: 'Get Rewards',
            href: '/submit?tag=contribution',
          },
          {
            name: 'Jobs',
            href: '/jobs',
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
        ],
      },
      {
        name: 'Marketplace',
        icon: RocketLaunchIcon,
        href: '/marketplace',
      },
    ]
  }, [citizen])

  return navigation
}
