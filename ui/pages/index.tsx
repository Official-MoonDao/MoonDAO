import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import Callout1 from '../components/home/Callout1'
import Callout2 from '../components/home/Callout2'
import Callout3 from '../components/home/Callout3'
import Feature from '../components/home/Feature'
import Hero from '../components/home/Hero'
import PartnerSection from '../components/home/PartnerSection'
import SpeakerSection from '../components/home/SpeakerSection'
import Video from '../components/home/Video'
import Container from '../components/layout/Container'
import Footer from '../components/layout/Footer'
import WebsiteHead from '../components/layout/Head'
import PageEnder from '../components/layout/PreFooter'

export default function Home({ linkSource }: any) {
  const router = useRouter()
  const account = useActiveAccount()

  //If the user is loading the page directly and has a citizen nft, redirect to their citizen page
  useEffect(() => {
    async function routeToCitizen() {
      try {
        const citizenContract = getContract({
          client,
          chain: DEFAULT_CHAIN_V5,
          address: CITIZEN_ADDRESSES[getChainSlug(DEFAULT_CHAIN_V5)],
          abi: CitizenABI as any,
        })
        const ownedTokenId = await readContract({
          contract: citizenContract,
          method: 'getOwnedToken' as string,
          params: [account?.address],
        })
        const citizen = await getNFT({
          contract: citizenContract,
          tokenId: ownedTokenId,
        })

        if (citizen?.metadata?.name && citizen?.metadata?.id != undefined) {
          const prettyLink = generatePrettyLinkWithId(
            citizen?.metadata?.name as string,
            String(citizen?.metadata?.id) as string
          )
          if (prettyLink) router.push(`/citizen/${prettyLink}`)
        }
      } catch (err) {
        console.log(err)
      }
    }

    if (linkSource === 'direct' && account) routeToCitizen()
  }, [linkSource, account, router])

  return (
    <Container>
      <WebsiteHead
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
      />
      <div>
        <Hero />
        <Video />
        <Callout1 />
        <Callout2 />
        <Feature />
        <SpeakerSection />
        <Callout3 />
        <PartnerSection />
        <PageEnder />
        <Footer darkBackground={true} />
      </div>
    </Container>
  )
}

export async function getServerSideProps(context: any) {
  const { req } = context
  const referer = req.headers.referer || req.headers.referrer

  let linkSource = 'direct'
  if (referer) {
    if (referer.startsWith(req.headers.host)) {
      linkSource = 'internal'
    } else {
      linkSource = 'external'
    }
  }

  return {
    props: { linkSource },
  }
}
