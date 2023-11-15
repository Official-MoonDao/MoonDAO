import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  DocumentIcon,
  HandRaisedIcon,
} from '@heroicons/react/24/outline'
import {
  BuildingLibraryIcon,
  DocumentCheckIcon,
  LightBulbIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/solid'
import { useAddress } from '@thirdweb-dev/react'
import Image from 'next/image'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useDelegateVotingPower } from '../lib/privy/hooks/useDelegateVotingPower'
import { useExportPrivyWallet } from '../lib/privy/hooks/useExportPrivyWallet'
import Head from '../components/layout/Head'
import { PageCards } from '../components/layout/PageCards'

export default function Governance() {
  const [enableExportModal, setEnableExportModal] = useState(false)

  const pages: any = [
    {
      name: 'Export Wallet',
      description:
        'Export your embedded wallet to an external wallet. All tokens and voting power will be sent to the specified wallet address.',
      onClick: () => {
        setEnableExportModal(true)
      },
      icon: ArrowRightIcon,
      externalLink: true,
    },
    {
      name: 'Get Gitcoin Passport',
      description:
        'We require a score of 15 or above for voting. This is to make sure you are a unique human.',
      href: 'We require a score of 15 or above for voting. This is to make sure you are a unique human.',
      icon: ArrowsRightLeftIcon,
      externalLink: true,
    },
    {
      name: 'Submit a Proposal',
      description:
        'Proposals start in our “Ideation” channel in the Discord. Post your idea there to get feedback and start the submission process!',
      href: 'https://discord.com/channels/914720248140279868/1027658256706961509',
      icon: DocumentIcon,
      externalLink: false,
    },
    {
      name: 'Vote on Snapshot',
      description:
        'Our community uses Snapshot to vote. Click here to navigate and view active proposals.',
      href: 'https://snapshot.org/#/tomoondao.eth',
      icon: HandRaisedIcon,
      externalLink: true,
    },
  ]

  const [delegateAddress, setDelegateAddress] = useState('')
  const exportPrivyWallet = useExportPrivyWallet(delegateAddress)

  return (
    <div className="animate-fadeIn">
      <Head title="Governance" description="MoonDAO Governance introduction." />

      {/*Section containing cards with links*/}
      <PageCards
        id="gov-cards"
        pages={pages}
        title="Governance"
        description={` MoonDAO’s Treasury is governed by all the token holders. If you have
          voting power, follow these steps to get setup for voting.\n\nYou can read MoonDAO’s Constitution to understand more about how our
          governance works.`}
      />
    </div>
  )
}
