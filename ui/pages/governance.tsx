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
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import React, { useEffect, useState, useContext } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../lib/privy/privy-wallet-context'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import PreFooter from '../components/layout/PreFooter'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

// Dynamically import CardGrid to prevent SSR-related issues
const IndexCardGrid = dynamic(
  () => import('../components/layout/IndexCardGrid'),
  {
    ssr: false,
  }
)

const Governance: React.FC = () => {
  const router = useRouter()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const { exportWallet } = usePrivy()

  const [isClient, setIsClient] = useState(false)

  // Ensure code only runs on the client-side after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  const indexCardData = [
    {
      icon: '/assets/icon-wallet.svg',
      iconAlt: 'Export Wallet',
      header: 'Export Wallet',
      hovertext: 'Export Wallet',
      paragraph: <>Export your embedded wallet to an external wallet.</>,
      onClick: () => {
        if (isClient) {
          exportWallet().catch(() =>
            toast.error('Please select a privy wallet to export.')
          )
        }
      },
      inline: true,
    },
    {
      icon: '/assets/icon-wallet.svg',
      iconAlt: 'Get $MOONEY',
      header: 'Get $MOONEY',
      link: 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet',
      hovertext: 'Get $MOONEY',
      paragraph: (
        <>
          Join the MoonDAO community by acquiring our governance token $MOONEY
          on UniSwap.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-power.svg',
      iconAlt: 'Get Voting Power',
      header: 'Get Voting Power',
      link: '/lock',
      hovertext: 'Get Voting Power',
      paragraph: (
        <>
          Voting power is granted to stakeholders, stake $MOONEY to fully
          participate in co-governance and co-creation.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-bridge.svg',
      iconAlt: 'Bridge $MOONEY',
      header: 'Bridge $MOONEY',
      link: 'https://www.youtube.com/watch?v=oQtHjbcbAio',
      hovertext: 'Bridge $MOONEY',
      paragraph: (
        <>
          Learn how you can reduce onchain gas fees by bridging $MOONEY from L1
          to L2.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-verify.svg',
      iconAlt: 'Prove Humanity',
      header: 'Prove Humanity',
      link: 'https://passport.gitcoin.co/',
      hovertext: 'Prove Humanity',
      paragraph: (
        <>
          In addition to being a stakeholder, we require voters to utilize
          Gitcoin Passport with a score of 15 or above for voting. This is to
          make sure you are a unique human.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-role.svg',
      iconAlt: 'Guild.xyz',
      header: 'Guild.xyz',
      link: 'https://discord.com/channels/914720248140279868/945284940721975356',
      hovertext: 'Connect with Guild.xyz',
      paragraph: (
        <>
          Connect your Discord and wallet to Guild.xyz to unlock new roles and
          permissions based on your holdings to see everything that is happening
          with projects and governance.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-vote.svg',
      iconAlt: 'Vote on Nance',
      header: 'Vote on Nance',
      link: '/vote',
      hovertext: 'Vote on Nance',
      paragraph: (
        <>
          Our community uses Nance to vote. Click here to navigate and view
          active proposals.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-governance.svg',
      iconAlt: 'City Hall',
      header: 'City Hall',
      link: 'https://discord.com/channels/914720248140279868/1175882517149130892',
      hovertext: 'Visit City Hall',
      paragraph: (
        <>
          City Hall channels are home to MoonDAO's governance processes, where
          decisions regarding proposals and our internal operations are
          addressed.
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-ideation.svg',
      iconAlt: 'Post an Idea',
      header: 'Post an Idea',
      link: 'https://discord.com/channels/914720248140279868/1027658256706961509',
      hovertext: 'Submit a Proposal',
      paragraph: (
        <>
          Most proposals start in our “Ideation” channel in the Discord. Post
          your idea there to get feedback and start the submission process!
        </>
      ),
      inline: true,
    },
    {
      icon: '/assets/icon-submit-proposal.svg',
      iconAlt: 'Submit a Proposal',
      header: 'Submit a Proposal',
      link: '/propose',
      hovertext: 'Submit a Proposal',
      paragraph: (
        <>Submit a proposal for funding through MoonDAO's project system!</>
      ),
      inline: true,
    },
  ]

  const title = 'Governance'
  const description =
    "MoonDAO's Treasury is governed by its Citizens. If you don't have voting power, become a Citizen by joining our community. You can read MoonDAO's Constitution to understand more about how our governance works."

  return (
    <>
      <WebsiteHead
        title={title}
        description={description}
        image="/assets/moondao-og.jpg"
      />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={title}
            headerSize="max(20px, 3vw)"
            description={<>{description}</>}
            preFooter={<NoticeFooter />}
            mainPadding
            mode="compact"
            popOverEffect={false}
            isProfile
          >
            <div className="mt-10 mb-10 flex justify-center">
              <IndexCardGrid cards={indexCardData} singleCol={false} />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

export default Governance
