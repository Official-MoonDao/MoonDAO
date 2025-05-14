import CitizenTableABI from 'const/abis/CitizenTable.json'
import JobTableABI from 'const/abis/JobBoardTable.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import {
  CITIZEN_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
} from 'const/config'
import Image from 'next/image'
import { getContract, readContract } from 'thirdweb'
import { MediaRenderer } from 'thirdweb/react'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client, { serverClient } from '@/lib/thirdweb/client'
import Container from '@/components/layout/Container'

function HomeCard({
  title,
  description,
  image,
}: {
  title: string
  description: string
  image: string
}) {
  return (
    <div className="relative animate-fadeIn flex flex-col bg-dark-cool w-full h-full rounded-[20px] overflow-hidden">
      {/* Background gradient accent */}
      <div className="bg-darkest-cool rounded-[20px] w-[30%] h-[30%] absolute top-0 left-0"></div>

      {/* Content container */}
      <div className="relative z-10 p-6 flex flex-col gap-4">
        {/* Image section */}
        {image && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden">
            {image.startsWith('ipfs://') ? (
              <MediaRenderer
                client={client}
                src={image}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={image}
                alt={title}
                className="w-full h-full object-cover"
                width={100}
                height={100}
              />
            )}
          </div>
        )}

        {/* Text content */}
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-GoodTimes text-white">{title}</h2>
          <p className="text-gray-400">{description}</p>
        </div>
      </div>
    </div>
  )
}

export default function Home({
  newestNewsletters,
  newestCitizens,
  newestProposals,
  newestListings,
  newestJobs,
  currentQuarterETHRewards,
}: any) {
  return (
    <Container>
      <h1 className="text-4xl font-bold mt-24">HOME</h1>

      <div className="flex flex-col w-full">
        <div className="w-full flex">
          <h1 className="text-2xl font-bold">Newest Citizens</h1>
          {newestCitizens.map((citizen: any) => (
            <HomeCard
              key={citizen.id}
              title={citizen.name}
              description={citizen.description}
              image={citizen.image}
            />
          ))}
        </div>
      </div>
    </Container>
  )
}

export async function getStaticProps() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)

  const newestNewsletters: any = []

  const citizenTableContract = getContract({
    client: serverClient,
    address: CITIZEN_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: CitizenTableABI as any,
  })
  const citizenTableName = await readContract({
    contract: citizenTableContract,
    method: 'getTableName',
  })
  const newestCitizens: any = await queryTable(
    chain,
    `SELECT * FROM ${citizenTableName} ORDER BY id DESC LIMIT 10`
  )

  const newestProposals: any = []

  const marketplaceTableContract = getContract({
    client: serverClient,
    address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: MarketplaceTableABI as any,
  })
  const marketplaceTableName = await readContract({
    contract: marketplaceTableContract,
    method: 'getTableName',
  })
  const newestListings: any = await queryTable(
    chain,
    `SELECT * FROM ${marketplaceTableName} ORDER BY id DESC LIMIT 10`
  )

  const jobTableContract = getContract({
    client: serverClient,
    address: JOBS_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: JobTableABI as any,
  })
  const jobTableName = await readContract({
    contract: jobTableContract,
    method: 'getTableName',
  })
  const newestJobs: any = await queryTable(
    chain,
    `SELECT * FROM ${jobTableName} ORDER BY id DESC LIMIT 10`
  )

  const currentQuarterETHRewards: number = 0

  return {
    props: {
      newestNewsletters,
      newestCitizens,
      newestProposals,
      newestListings,
      newestJobs,
      currentQuarterETHRewards,
    },
    revalidate: 60,
  }
}
