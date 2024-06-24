import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { NFT, useContract, useNFTs } from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES, ENTITY_ADDRESSES } from 'const/config'
import {
  blockedCitizens,
  blockedEntities,
  featuredEntities,
} from 'const/whitelist'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import Head from '../components/layout/Head'
import { SearchIcon } from '@/components/assets'
import EntityCitizenCard from '@/components/directory/EntityCitizenCard'
import Tab from '@/components/layout/Tab'

export default function Directory({ _citizens, _entities }: any) {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)
  const router = useRouter()
  const shallowQueryRoute = useShallowQueryRoute()

  const [input, setInput] = useState('')
  function filterBySearch(nfts: NFT[]) {
    return nfts.filter((nft) => {
      return nft.metadata.name
        ?.toString()
        .toLowerCase()
        .includes(input.toLowerCase())
    })
  }

  const [tab, setTab] = useState<string>('all')
  function loadByTab(tab: string) {
    if (tab === 'entities') {
      setCachedNFTs(
        input != '' ? filterBySearch(filteredEntities) : filteredEntities
      )
    } else if (tab === 'citizens') {
      setCachedNFTs(
        input != '' ? filterBySearch(filteredCitizens) : filteredCitizens
      )
    } else {
      const nfts =
        filteredEntities?.[0] && filteredCitizens?.[0]
          ? [...filteredEntities, ...filteredCitizens]
          : filteredCitizens?.[0]
          ? filteredCitizens
          : filteredEntities?.[0]
          ? filteredEntities
          : []
      setCachedNFTs(input != '' ? filterBySearch(nfts) : nfts)
    }
    // shallowQueryRoute({ type: tab })
  }

  // Citizen and Entity Data
  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  )
  const { contract: citizenContract } = useContract(
    CITIZEN_ADDRESSES[selectedChain.slug]
  )

  const { data: totalEntities } = useHandleRead(entityContract, 'totalSupply')
  const { data: totalCitizens } = useHandleRead(entityContract, 'totalSupply')

  const [maxPage, setMaxPage] = useState(1)

  useEffect(() => {
    if (!totalEntities || !totalCitizens) return
    if (tab === 'entities') setMaxPage(Math.ceil(totalEntities?.toNumber() / 9))
    if (tab === 'citizens') setMaxPage(Math.ceil(totalCitizens?.toNumber() / 9))
    if (tab === 'all')
      setMaxPage(
        Math.ceil((totalEntities.toNumber() + totalCitizens.toNumber()) / 9)
      )
  }, [totalEntities, totalCitizens, tab])

  const [cachedNFTs, setCachedNFTs] = useState<NFT[]>([])

  // const {
  //   data: entities,
  //   isLoading: isLoadingEntities,
  //   error,
  // } = useNFTs(entityContract, { start: 0, count: 100 })

  // const { data: citizens, isLoading: isLoadingCitizens } = useNFTs(
  //   citizenContract,
  //   { start: 0, count: 100 }
  // )

  const [entities, setEntities] = useState(_entities)
  const [citizens, setCitizens] = useState(_citizens)

  useEffect(() => {
    if (entityContract) {
      ;(async () => {
        const entities = await entityContract.erc721.getAll()
        setEntities(entities)
      })()
    }
  }, [entityContract])

  useEffect(() => {
    if (citizenContract) {
      ;(async () => {
        const citizens = await citizenContract.erc721.getAll()
        setCitizens(citizens)
      })()
    }
  }, [citizenContract])

  const [filteredEntities, setFilteredEntities] = useState<NFT[]>([])
  const [filteredCitizens, setFilteredCitizens] = useState<NFT[]>([])

  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    const type = router.query.type
    if (type) {
      setTab(type as string)
    }
  }, [router])

  //only show public nfts that are whitelisted
  useEffect(() => {
    if (entityContract) {
      const filteredPublicEntities: any = entities?.filter(
        (nft: any) =>
          nft.metadata.attributes?.find(
            (attr: any) => attr.trait_type === 'view'
          ).value === 'public' && !blockedEntities.includes(nft.metadata.id)
      )

      const now = Math.floor(Date.now() / 1000)

      const filteredValidEntities: any = filteredPublicEntities?.filter(
        async (nft: any) => {
          const expiresAt = await entityContract.call('expiresAt', [
            nft?.metadata?.id,
          ])

          return expiresAt.toNumber() > now
        }
      )

      setFilteredEntities(filteredValidEntities)
    }
  }, [entities, entityContract])

  useEffect(() => {
    if (citizenContract) {
      const filteredPublicCitizens: any = citizens?.filter(
        (nft: any) =>
          nft.metadata.attributes?.find(
            (attr: any) => attr.trait_type === 'view'
          ).value === 'public' && !blockedCitizens.includes(nft.metadata.id)
      )
      const now = Math.floor(Date.now() / 1000)

      const filteredValidCitizens: any = filteredPublicCitizens?.filter(
        async (nft: any) => {
          const expiresAt = await citizenContract.call('expiresAt', [
            nft?.metadata?.id,
          ])

          return expiresAt.toNumber() > now
        }
      )
      setFilteredCitizens(filteredValidCitizens)
    }
  }, [citizens, citizenContract])

  useEffect(() => {
    loadByTab(tab)
  }, [tab, input, filteredEntities, filteredCitizens, router.query])

  useEffect(() => {
    if (router.query.type || router.asPath === '/directory')
      shallowQueryRoute({ type: tab })
  }, [tab])

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    )
  }, [])

  return (
    <main className="animate-fadeIn">
      <Head title="Directory" image="" />
      <div className="flex flex-col items-center lg:items-start space-y-10 mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 bg-[white] dark:bg-[#080C20] font-RobotoMono w-[350px] sm:w-[400px] lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white page-border-and-color">
        <h1 className={`page-title`}>Directory</h1>
        <div className="px-4 w-full max-w-[350px] h-[30px] flex items-center space-x-5 text-black dark:text-white">
          <SearchIcon />
          <input
            className="w-full rounded-sm px-4 py-2 bg-moon-orange bg-opacity-25 text-moon-orange placeholder:text-moon-orange"
            onChange={({ target }) => setInput(target.value)}
            value={input}
            type="text"
            name="search"
            placeholder="Search..."
          />
        </div>

        <div className="md:px-4 grid grid-cols-3 gap-4 text-sm">
          <Tab tab="all" currentTab={tab} setTab={setTab}>
            All
          </Tab>
          <Tab tab="entities" currentTab={tab} setTab={setTab}>
            Entities
          </Tab>
          <Tab tab="citizens" currentTab={tab} setTab={setTab}>
            Citizens
          </Tab>
        </div>

        <div
          className="grid grid-cols-1
      min-[1100px]:grid-cols-2 min-[1450px]:grid-cols-3 mt-5 gap-y-5 justify-evenly items-center justify-items-center lg:justify-items-start place-items-center"
        >
          {cachedNFTs
            ?.slice((pageIdx - 1) * 9, pageIdx * 9)
            .map((nft: any, i: number) => {
              if (nft.metadata.name !== 'Failed to load NFT metadata') {
                const type = nft.metadata.attributes.find(
                  (attr: any) => attr.trait_type === 'communications'
                )
                  ? 'entity'
                  : 'citizen'
                return (
                  <div key={'entity-citizen-' + i}>
                    <EntityCitizenCard
                      metadata={nft.metadata}
                      owner={nft.owner}
                      type={type}
                    />
                  </div>
                )
              }

              //if citizen address return citizen
            })}
        </div>

        <div className="w-full flex flex-row justify-center lg:justify-start space-x-8">
          {pageIdx === 1 ? (
            <p></p>
          ) : (
            <button
              onClick={() => {
                if (pageIdx > 1) {
                  setPageIdx(pageIdx - 1)
                }
              }}
            >
              <ChevronLeftIcon height={25} width={25} />
            </button>
          )}

          <p>{pageIdx}</p>
          <button
            onClick={() => {
              if (pageIdx < maxPage) {
                setPageIdx(pageIdx + 1)
              }
            }}
          >
            <ChevronRightIcon height={25} width={25} />
          </button>
        </div>
      </div>
    </main>
  )
}

export async function getStaticProps() {
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const sdk = initSDK(chain)

  const entityContract = await sdk.getContract(ENTITY_ADDRESSES[chain.slug])
  const entities = await entityContract.erc721.getAll()

  const citizenContract = await sdk.getContract(CITIZEN_ADDRESSES[chain.slug])
  const citizens = await citizenContract.erc721.getAll()

  return {
    props: {
      _entities: entities,
      _citizens: citizens,
    },
    revalidate: 60,
  }
}
