import {
  BuildingLibraryIcon,
  PencilSquareIcon,
  IdentificationIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useState } from 'react'
import Head from '../components/layout/Head'
import { PageCards } from '../components/layout/PageCards'
import { ExportPrivyWalletModal } from '../components/privy/ExportPrivyWalletModal'

export default function Governance() {
  const router = useRouter()
  const [enableExportModal, setEnableExportModal] = useState(false)

  const pages: any = [
    {
      name: 'Export Wallet',
      description:
        'Export your embedded wallet to an external wallet. All tokens and voting power will be sent to the specified wallet address.',
      onClick: () => {
        setEnableExportModal(true)
      },

      icon: <BuildingLibraryIcon width={50} />,
      buttonText: 'Delegate',
    },
    {
      name: 'Get Gitcoin Passport',
      description:
        'We require a score of 15 or above for voting. This is to make sure you are a unique human.',
      href: 'https://passport.gitcoin.co/',
      icon: <IdentificationIcon width={50} />,
      externalLink: true,
      buttonText: 'Get Passport',
    },
    {
      name: 'Submit a Proposal',
      description:
        'Proposals start in our “Ideation” channel in the Discord. Post your idea there to get feedback and start the submission process!',
      href: 'https://discord.com/channels/914720248140279868/1027658256706961509',
      icon: <PencilSquareIcon width={50} />,
      externalLink: true,
      buttonText: 'Discord "Ideation"',
    },
    {
      name: 'Vote on Snapshot',
      description:
        'Our community uses Snapshot to vote. Click here to navigate and view active proposals.',
      href: 'https://snapshot.org/#/tomoondao.eth',
      icon: <ArchiveBoxArrowDownIcon width={50} />,
      externalLink: true,
      buttonText: 'Snapshot',
    },
  ]

  return (
    <div className="animate-fadeIn">
      <Head title="Governance" description="MoonDAO Governance introduction." />

      {/*Section containing cards with links*/}
      <PageCards
        id="gov-cards"
        pages={pages}
        title="Governance"
        description={
          <>
            {/* {`MoonDAO's Treasury is governed by its Citizens. If you don't have voting power, become a Citizen by `} */}
            <p className="mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 text-left text-sm xl:text-base">
              MoonDAO’s Treasury is governed by all the token holders. If you
              have voting power, follow these steps to get setup for voting.
              <br />
              <br className="2xl:hidden" />
              You can read MoonDAO’s Constitution to understand more about how
              our governance works.
            </p>
          </>
        }
      />
      {enableExportModal && (
        <ExportPrivyWalletModal setEnabled={setEnableExportModal} />
      )}
    </div>
  )
}
