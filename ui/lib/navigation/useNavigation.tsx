import {
  BuildingLibraryIcon,
  ClipboardDocumentListIcon,
  FolderIcon,
  PlusIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline'
import { useMemo } from 'react'
import IconOrg from '@/components/assets/IconOrg'

export default function useNavigation(citizen: any) {
  const navigation = useMemo(() => {
    return [
      {
        name: 'Join',
        href: '/join',
        icon: PlusIcon,
        children: [
          !citizen && { name: 'Become a Citizen', href: '/citizen' },
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
          { name: 'Bridge', href: '/bridge' },
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
  }, [citizen])

  return navigation
}
