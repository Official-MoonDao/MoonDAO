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
import Finalist from '@/components/wba/Finalist'
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
        name: 'Test',
        citizenId: 1,
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        writtenUrl: 'https://bitcoin.org/bitcoin.pdf',
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
