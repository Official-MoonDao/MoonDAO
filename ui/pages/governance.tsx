import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  DocumentIcon,
  HandRaisedIcon,
  LockClosedIcon,
  WalletIcon
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
      name: 'Buy $MOONEY',
      description: 'Acquire our governance token and join the community.',
      href: 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
      icon: WalletIcon,
      externalLink: true,
    },
    {
      name: 'Get Voting Power',
      description: 'Stake $MOONEY to get voting power within MoonDAO.',
      href: '/lock',
      icon: LockClosedIcon,
      externalLink: false,
    },
    {
      name: 'Bridge $MOONEY',
      description: 'Bridge $MOONEY from L1 to L2 for reduced gas fees.',
      href: 'https://wallet.polygon.technology/polygon/bridge/deposit',
      icon: ArrowsRightLeftIcon,
      externalLink: true,
    },
    {
      name: 'Export Wallet',
      description:
        'Export your embedded wallet to an external wallet. All tokens and voting power will be sent to the specified wallet address.',
      onClick: () => {
        setEnableExportModal(true)
      },
      icon: ArrowRightIcon,
    },
    {
      name: 'Get Gitcoin Passport',
      description:
        'We require a score of 15 or above for voting. This is to make sure you are a unique human.',
      href: 'https://passport.gitcoin.co/',
      icon: ArrowsRightLeftIcon,
      externalLink: true,
    },
    {
      name: 'Submit a Proposal',
      description:
        'Proposals start in our “Ideation” channel in the Discord. Post your idea there to get feedback and start the submission process!',
      href: 'https://discord.com/channels/914720248140279868/1027658256706961509',
      icon: DocumentIcon,
      externalLink: true,
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
            {`MoonDAO's Treasury is governed by its Citizens. If you don't have voting power, become a Citizen by `}
            <button
              className="hover:scale-[1.05] duration-300 ease-in-out font-bold"
              onClick={() => router.push('/onboarding')}
            >
              onboarding
            </button>
            {` into our community. You can read MoonDAO's `}
            <button
              className="hover:scale-[1.05] duration-300 ease-in-out font-bold"
              onClick={() =>
                window.open(
                  'https://publish.obsidian.md/moondao/MoonDAO/docs/Constitution'
                )
              }
            >
              Constitution
            </button>
            {` to understand more about how our governance works.`}
          </>
        }
      />
      {enableExportModal && (
        <ExportPrivyWalletModal setEnabled={setEnableExportModal} />
      )}
    </div>
  )
}
