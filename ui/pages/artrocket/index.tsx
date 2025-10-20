import {
  IPFS_GATEWAY,
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  VOTES_TABLE_NAMES,
  BAIKONUR_VOTE_ID,
} from 'const/config'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { arbitrum } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { DistributionVote } from '@/lib/tableland/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { Baikonur, BaikonurProps } from '@/components/baikonur/Baikonur'
import { Finalist } from '@/components/baikonur/Finalist'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import DistributionVotes from '@/components/tableland/DistributionVotes'

export default function ArtRocket({ distributions, finalists }: BaikonurProps) {
  const router = useRouter()
  return (
    <Container>
      <WebsiteHead
        title="Art Rocket Project"
        description="Art Rocket Project: Attend the Launch"
        image={`${IPFS_GATEWAY}/bafybeifkfe5t6ihnqxwr4uksiiphj2obshr5baslkl4v36yo2jxbxigazu`}
      />
      <ContentLayout
        header={
          <p>
            Art Rocket Project:
            <br />
            Attend the Launch
          </p>
        }
        description={
          <p>
            Inspired by the success of the MoonDAO and Unity Foundation Art
            Rocket Project in Brazil, we're excited to launch a contest that
            carries forward its legacy and{' '}
            <span className="font-bold font-sans">
              gives you the chance to attend the rocket launch in person in
              Kazakhstan!
            </span>{' '}
            The Art Rocket Project in Brazil combined space exploration with art
            therapy for oncology patients, culminating with their artwork set to
            be launched on a Soyuz rocket from Baikonur Cosmodrome (22-29
            November 2025).
            <br />
            <br />
            Now, it's your turn to dream big and propose the next innovative
            project for MoonDAO, while joining an unforgettable trip to witness
            the Soyuz Art Rocket launch live at Baikonur Cosmodrome in
            Kazakhstan!
            <br />
            <br />
            View finalists and vote for the candidate or candidates you believe
            should get the chance to attend the launch. Distribute your voting
            power (square root of vMOONEY balance) as a percentage between the
            candidates. You can vote for multiple people.
          </p>
        }
        headerSize="max(20px, 3vw)"
        preFooter={<NoticeFooter />}
        mainPadding
        mode="compact"
        popOverEffect={false}
        isProfile
      >
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full">
            <Baikonur
              finalists={finalists}
              distributions={distributions}
              refresh={() => router.reload()}
            />
          </div>
          {/* <div className="w-full">
            <DistributionVotes
              votes={distributions}
              finalists={finalists}
              title="Art Rocket Project Votes"
              refetch={() => router.reload()}
            />
          </div> */}
        </div>
        <div className="mt-8 space-y-6">
          <div className="space-y-6">
            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <div className="lg:float-left lg:w-1/2 lg:mr-6 lg:mb-4 mb-6">
                <Image
                  className="w-full h-full max-w-[800px] max-h-[800px] rounded-xl"
                  src="/assets/baikonur_launch.png"
                  alt="Baikonur Launch"
                  width={800}
                  height={800}
                />
              </div>

              <h2 className="text-2xl font-bold mb-4 text-white">
                About the Inspiration: Art Rocket Project in Brazil
              </h2>
              <p className="text-gray-300 leading-relaxed">
                The Art Rocket Project (MDP-181) brought hope to over 500
                oncology patients through art therapy workshops in Rio de
                Janeiro, Natal, Brasília and Foz do Iguacu. Patients' drawings
                of their dreams will be incorporated into a collage on this
                Soyuz rocket, symbolizing the intersection of space dreams and
                human resilience.
              </p>
              <p className="text-gray-300 leading-relaxed mt-4">
                Led by MoonDAO and the Unity Foundation, and accompanied by
                astronaut and cardiologist Eiman Jahangir and Russian cosmonaut
                Denis Matveev, the mission partnered with local universities, an
                analog station, and hospitals or clinics around Brazil to
                promote democratizing access to space while addressing social
                issues like cancer support. This project exemplifies MoonDAO's
                mission to unite space innovation with global social impact.
              </p>

              <div className="clear-both"></div>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Contest Details
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Building on this legacy, submit your idea for MoonDAO's next
                major project. Your idea should innovatively blend:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-2 text-gray-300">
                <li>
                  <strong className="font-sans">Space exploration:</strong>{' '}
                  Elements from the space sector, such as research, science,
                  technology, education and even art.
                </li>
                <li>
                  <strong className="font-sans">Social impact:</strong> Tackling
                  a key social issue, like health, education, environmental
                  challenges, or community empowerment.
                </li>
                <li>
                  <strong className="font-sans">Country focus:</strong> Centered
                  on a specific country or region to amplify reach and relevance
                  with the theme of international collaboration.
                </li>
              </ul>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Submission Requirements
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-300">
                <li>
                  <strong className="font-sans">Project Description:</strong> A
                  concise written summary of your idea (maximum 500 words),
                  outlining the concept, integration of themes, and expected
                  impact.
                </li>
                <li>
                  <strong className="font-sans">Short Video:</strong> A 2–3
                  minute video pitch explaining your project posted on social
                  media and tagging MoonDAO, its inspiration from the Art Rocket
                  Project, and why it deserves to be MoonDAO's next venture.
                </li>
                <li>
                  All contestants must be MoonDAO citizens by the submission
                  deadline.
                </li>
              </ul>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">Deadline</h2>
              <p className="text-gray-300 leading-relaxed">
                All entries must be submitted by{' '}
                <strong className="text-blue-300">October 2, 2025</strong>.
              </p>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">
                How to Submit
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Send your written statement and a link to your video posted on
                social media to{' '}
                <Link
                  href="mailto:info@moondao.com"
                  className="text-blue-300 hover:underline"
                >
                  info@moondao.com
                </Link>
                . Make sure your idea aligns with MoonDAO's ethos of making
                space accessible to all while creating positive change on Earth,
                and make sure to tag MoonDAO.
              </p>
              <p className="text-gray-300 leading-relaxed mt-4">
                This contest is your chance to extend the Art Rocket Project's
                legacy, propose ideas that inspire, unite, and propel humanity
                forward. Enter now for a chance to join us at the launch!
              </p>
              <p className="text-gray-300 leading-relaxed mt-4">
                In the event of more than 10 submissions, a selection committee
                will determine the top 10 candidates who will go up for a vote
                by MoonDAO Members to determine the finalist and runners-up.
              </p>
            </section>

            <section className="bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all duration-300">
              <h2 className="text-2xl font-bold mb-4 text-white">
                Prize Details
              </h2>
              <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                <ul className="list-disc pl-6 space-y-3 text-gray-300">
                  <li>
                    <strong className="text-green-300">
                      MoonDAO will provide up to $1,200
                    </strong>{' '}
                    to partially cover travel expenses to Moscow, Russia, where
                    the selected applicant will spend 2 days exploring the city
                    before heading to Baikonur.
                  </li>
                  <li>
                    <strong className="text-green-300">
                      Our partners will cover
                    </strong>{' '}
                    the round-trip travel from Moscow to Baikonur, including 5
                    days at the Baikonur Cosmodrome with hotel accommodations,
                    meals, and a special program included.
                  </li>
                </ul>
              </div>
            </section>
          </div>

          <div className="clear-both"></div>
        </div>
      </ContentLayout>
    </Container>
  )
}

export async function getStaticProps() {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const prodChain = arbitrum
    const prodChainSlug = getChainSlug(prodChain)

    const distributionStatement = `SELECT * FROM ${VOTES_TABLE_NAMES[chainSlug]} WHERE voteId = ${BAIKONUR_VOTE_ID}`
    const distributions = (await queryTable(
      chain,
      distributionStatement
    )) as DistributionVote[]
    let finalists: Finalist[] = [
      {
        id: 0,
        name: 'Leandro Kästrup',
        videoUrl: 'https://www.instagram.com/p/DPRp-iDEayw/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.c5l9c171gzkc',
        citizenId: 150,
      },
      {
        id: 1,
        name: 'Faber Burgos Sarmiento',
        videoUrl: 'https://www.instagram.com/p/DPRxPNLkdnE/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.hblee6psc01c',
        citizenId: 63,
      },
      {
        id: 2,
        name: 'Moonshot',
        videoUrl: 'https://x.com/MaldivesSpace/status/1973493014791397493',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.wt59usbk25c',
        citizenId: 147,
      },
      {
        id: 3,
        name: 'justtheletterk',
        videoUrl: 'https://www.instagram.com/reel/DPSOyL6gZPQ/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.9khtknpviv64',
        citizenId: 103,
      },
      {
        id: 4,
        name: 'Jagriti',
        videoUrl: 'https://www.youtube.com/watch?v=8kvkhSaRS3o',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.5hmp6quo0uto',
        citizenId: 149,
      },
      {
        id: 5,
        name: 'AstroJuris',
        videoUrl: 'https://www.instagram.com/p/DPUViBWD2DQ/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.nc7z3lvjcs7n',
        citizenId: 95,
      },
      {
        id: 6,
        name: 'Julio Rezende',
        videoUrl: 'https://www.instagram.com/p/DPUD9dykY-2/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.4hpch123mot0',
        citizenId: 73,
      },
      {
        id: 7,
        name: 'Marina Freitas',
        videoUrl: 'https://www.instagram.com/p/DPUbU5qEb0G/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.ycs1v45b44f3',
        citizenId: 145,
      },
      {
        id: 8,
        name: 'William S. Rabelo',
        videoUrl: 'https://www.instagram.com/p/DPUcipYD5iH/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.ces2sgynmk1z',
        citizenId: 148,
      },
      {
        id: 9,
        name: 'AstroShoh',
        videoUrl: 'https://www.instagram.com/p/DPUjlmMjNvX/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.ctxlckmzj2ps',
        citizenId: 135,
      },
      {
        id: 10,
        name: 'Maria Alejandra Botero Botero',
        videoUrl: 'https://www.instagram.com/reel/DPU7YZoDYJs/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.j3ko2gimyimu',
        citizenId: 79,
      },
      {
        id: 11,
        name: 'Astronautgio',
        videoUrl: 'https://www.instagram.com/reel/DPVTPRtAT95/',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.gewonlpcyzwa',
        citizenId: 24,
      },
      {
        id: 12,
        name: 'florencepauline',
        videoUrl:
          'https://drive.google.com/open?id=1BRFf2Q5TJgLol7ngDEyRXR-T8L9SNnRu',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.z5eefp370lyb',
        citizenId: 133,
      },
      {
        id: 13,
        name: 'Bera S. Badareva',
        videoUrl: 'https://www.youtube.com/watch?v=-vcaeg2BvmA',
        writtenUrl:
          'https://docs.google.com/document/d/1DFAB-Wd91Gw91nAqA36LddUJw-75G2D7L3Re4rsotRc/edit?tab=t.0#heading=h.xmg5v4svxoi4',
        citizenId: 151,
      },
    ]
    const finalistStatement = `SELECT * FROM ${
      CITIZEN_TABLE_NAMES[prodChainSlug]
    } WHERE id IN (${finalists
      .map((finalist) => finalist.citizenId)
      .join(',')})`
    const finalistCitizens = (await queryTable(
      prodChain,
      finalistStatement
    )) as any

    finalists.forEach((finalist) => {
      const citizen = finalistCitizens.find(
        (citizen: any) => +citizen.id === finalist.citizenId
      )
      finalist.address = citizen.owner
      finalist.image = citizen.image
    })

    const votingCitizensStatement = `SELECT id, name, owner FROM ${
      CITIZEN_TABLE_NAMES[prodChainSlug]
    } WHERE owner IN (${distributions
      .map((distribution) => `'${distribution.address}'`)
      .join(',')})`
    const votingCitizens = (await queryTable(
      prodChain,
      votingCitizensStatement
    )) as any

    distributions.forEach((distribution: DistributionVote) => {
      const citizen = votingCitizens.find(
        (citizen: any) =>
          citizen.owner.toLowerCase() === distribution.address.toLowerCase()
      )
      distribution.citizenName = citizen?.name || ''
      distribution.citizenId = citizen?.id || ''
    })

    return {
      props: {
        distributions,
        finalists,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error fetching distributions:', error)
    return {
      props: {
        distributions: [],
        finalists: [],
      },
      revalidate: 60,
    }
  }
}
