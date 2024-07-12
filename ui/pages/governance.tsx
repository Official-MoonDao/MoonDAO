import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  DocumentIcon,
  HandRaisedIcon,
  LockClosedIcon,
  WalletIcon,
  IdentificationIcon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../lib/privy/privy-wallet-context'
import Head from '../components/layout/Head'
import { PageCards } from '../components/layout/PageCards'

export default function Governance() {
  const router = useRouter()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const { exportWallet } = usePrivy()

  const [enableBridgeModal, setEnableBridgeModal] = useState(false)

  const sections: any = [
    {
      sectionName: 'Onchain Operations',
      pages: [
        {
          name: 'Export Wallet',
          description: 'Export your embedded wallet to an external wallet.',
          onClick: () => {
            exportWallet().catch((reason: any) =>
              toast.error('Please select a privy wallet to export.')
            )
          },
          icon: ArrowRightIcon,
        },
        {
          name: 'Get $MOONEY',
          description:
            'Join the MoonDAO community by acquiring our governance token $MOONEY on UniSwap.',
          href: 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
          icon: WalletIcon,
          externalLink: true,
        },
        {
          name: 'Get Voting Power',
          description:
            'Voting power is granted to stakeholders, stake $MOONEY to fully participate in co-governance and co-creation.',
          href: '/lock',
          icon: LockClosedIcon,
          externalLink: false,
        },
        {
          name: 'Bridge $MOONEY',
          description:
            'Reduce onchain gas fees by bridging $MOONEY from L1 to L2.',
          icon: ArrowsRightLeftIcon,
          href: 'https://wallet.polygon.technology/polygon/bridge/deposit',
          externalLink: true,
          hyperlink:
            'https://www.youtube.com/watch?v=oQtHjbcbAio&ab_channel=MoonDAO',
          hyperlinkText:
            'Click here to learn how to bridge Mooney to Polygon L2!',
        },
      ],
    },
    {
      sectionName: 'Proof of Personhood',
      pages: [
        {
          name: 'Prove Humanity',
          description:
            'In addition to being a stakeholder, we require voters to utilize Gitcoin Passport with a score of 15 or above for voting. This is to make sure you are a unique human.',
          href: 'https://passport.gitcoin.co/',
          icon: IdentificationIcon,
          externalLink: true,
        },
        {
          name: 'Guild.xyz',
          description:
            'Connect your Discord and wallet to Guild.xyz to unlock new roles and permissions based on your holdings to see everything that is happening with projects and governance.',
          href: 'https://discord.com/channels/914720248140279868/945284940721975356',
          icon: ShieldCheckIcon,
          externalLink: true,
        },
      ],
    },
    {
      sectionName: 'Participate',
      pages: [
        {
          name: 'Vote on Nance',
          description:
            'Our community uses Nance to vote. Click here to navigate and view active proposals.',
          href: '/vote',
          icon: HandRaisedIcon,
          externalLink: false,
        },
        {
          name: 'City Hall',
          description:
            "City Hall channels are home to MoonDAO's governance processes, where decisions regarding proposals and our internal operations are addressed.",
          href: 'https://discord.com/channels/914720248140279868/1175882517149130892',
          icon: BuildingLibraryIcon,
          externalLink: true,
        },
        {
          name: 'Submit a Proposal',
          description:
            'Proposals start in our “Ideation” channel in the Discord. Post your idea there to get feedback and start the submission process!',
          href: '/propose',
          icon: DocumentIcon,
          externalLink: false,
        },
      ],
    },
  ]

  const { t } = useTranslation('common')

  return (
    <div className="animate-fadeIn">
      <Head title={t('governanceTitle')} description={t('governanceDesc')} />

      {/*Section containing cards with links*/}
      <PageCards
        id="gov-cards"
        sections={sections}
        title="Governance"
        description={
          <p className="font-[Lato] text-left px-0">
            {`MoonDAO's Treasury is governed by its Citizens. If you don't have voting power, become a Citizen by `}
            <button
              className="hover:scale-[1.05] duration-300 ease-in-out font-bold text-moon-gold"
              onClick={() => router.push('/join')}
            >
              joining
            </button>
            {` our community. You can read MoonDAO's `}
            <button
              className="hover:scale-[1.05] duration-300 ease-in-out font-bold text-moon-gold"
              onClick={() =>
                window.open(
                  'https://docs.moondao.com/Governance/Constitution'
                )
              }
            >
              Constitution
            </button>
            {` to understand more about how our governance works.`}
          </p>
        }
      />
    </div>
  )
}
