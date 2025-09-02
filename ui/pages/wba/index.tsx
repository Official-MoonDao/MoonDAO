import {
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  VOTES_TABLE_NAMES,
  WBA_VOTE_ID,
} from 'const/config'
import { useRouter } from 'next/router'
import { arbitrum } from '@/lib/infura/infuraChains'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import { Finalist } from '@/components/wba/Finalist'
import { WBA, WBAProps } from '@/components/wba/WBA'

export default function WBAPage({ distributions, finalists }: WBAProps) {
  const router = useRouter()
  useChainDefault()
  return (
    <WBA
      finalists={finalists}
      distributions={distributions}
      refresh={() => router.reload()}
    />
  )
}

export async function getStaticProps() {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const prodChain = arbitrum
    const prodChainSlug = getChainSlug(prodChain)

    const distributionStatement = `SELECT * FROM ${VOTES_TABLE_NAMES[chainSlug]} WHERE voteId = ${WBA_VOTE_ID}`
    const distributions = await queryTable(chain, distributionStatement)
    let finalists: Finalist[] = [
      {
        id: 0,
        name: 'Brooke Shepard',
        citizenId: 139,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=19s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.srary1vs7oen',
      },
      {
        id: 1,
        name: 'Carlos Carrillo Rosa Lopes',
        citizenId: 131,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=151s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.u2b8hueai455',
      },
      {
        id: 2,
        name: 'Daniela Fernanda Cisternas',
        citizenId: 138,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=260s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.nmaf51cxrfle',
      },
      {
        id: 3,
        name: 'Domina Stamas',
        citizenId: 122,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=410s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.vs4s9uy8m640',
      },
      {
        id: 4,
        name: 'Florence Pauline Basubas',
        citizenId: 133,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=534s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.to14vqmswk2w',
      },
      {
        id: 5,
        name: 'Krishna Bulchandani',
        citizenId: 136,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=653s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.27muz2jzbpcs',
      },
      {
        id: 6,
        name: 'Ophir Ruimi',
        citizenId: 132,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=777s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.p5yf4qq4xyuy',
      },
      {
        id: 7,
        name: 'Rym Yasmine Chaid',
        citizenId: 141,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=871s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.7ulczltqfolq',
      },
      {
        id: 8,
        name: 'Sepideh Lashkari',
        citizenId: 123,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=1032s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.npw7ecimil0m',
      },
      {
        id: 9,
        name: 'Shriya Musuku',
        citizenId: 91,
        videoUrl: 'https://www.youtube.com/watch?v=nEnkisEsUlE&t=1174s',
        writtenUrl:
          'https://docs.google.com/document/u/1/d/e/2PACX-1vT1Zuxut7CDaj7kWdKtW6uuv0hk_AhTWRIbQfwdjYPPkO4YCzDAR6zM1_mz96RHqnxiG2ISL0o5-vEA/pub#h.1txixddced4l',
      },
    ]
    const statement = `SELECT * FROM ${
      CITIZEN_TABLE_NAMES[prodChainSlug]
    } WHERE id IN (${finalists
      .map((finalist) => finalist.citizenId)
      .join(',')})`
    const allCitizens = (await queryTable(prodChain, statement)) as any

    finalists.forEach((finalist) => {
      const citizen = allCitizens.find(
        (citizen: any) => +citizen.id === finalist.citizenId
      )
      finalist.address = citizen.owner
      finalist.image = citizen.image
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
