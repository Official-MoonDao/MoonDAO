import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { NFT, useContract, useNFTs } from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES, ENTITY_ADDRESSES } from 'const/config'
import { approvedCitizens, approvedEntities } from 'const/whitelist'
import { useRouter } from 'next/router'
import { cache, useContext, useEffect, useState } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import Head from '../components/layout/Head'
import { SearchIcon } from '@/components/assets'
import EntityCitizenCard from '@/components/directory/EntityCitizenCard'

export default function Directory() {
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

  const [tab, setTab] = useState('all')
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
      setCachedNFTs(
        input != ''
          ? [
              ...filterBySearch(filteredEntities),
              ...filterBySearch(filteredCitizens),
            ]
          : [...filteredEntities, ...filteredCitizens]
      )
    }
    // shallowQueryRoute({ type: tab })
  }

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

  const {
    data: entities,
    isLoading: isLoadingEntities,
    error,
  } = useNFTs(entityContract, { start: 0, count: 100 })

  const { data: citizens, isLoading: isLoadingCitizens } = useNFTs(
    citizenContract,
    { start: 0, count: 100 }
  )

  const [filteredEntities, setFilteredEntities] = useState<NFT[]>([])
  const [filteredCitizens, setFilteredCitizens] = useState<NFT[]>([])

  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    setTab(router.query.type || 'all')
  }, [router.query])

  //only show public nfts that are whitelisted
  useEffect(() => {
    const filtered: any = entities?.filter(
      (nft: any) =>
        nft.metadata.attributes?.find((attr: any) => attr.trait_type === 'view')
          .value === 'public' && approvedEntities.includes(nft.metadata.id)
    )
    setFilteredEntities(filtered)
  }, [entities])

  useEffect(() => {
    const filtered: any = citizens?.filter(
      (nft: any) =>
        nft.metadata.attributes?.find((attr: any) => attr.trait_type === 'view')
          .value === 'public' && approvedCitizens.includes(nft.metadata.id)
    )
    setFilteredCitizens(filtered)
  }, [citizens])

  useEffect(() => {
    if (filteredEntities?.[0] && filteredCitizens?.[0]) loadByTab(tab)
  }, [tab, input, filteredEntities, filteredCitizens, router.query])

  useEffect(() => {
    shallowQueryRoute({ type: tab })
  }, [tab])

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    )
  }, [])

  return (
    <main className="animate-fadeIn">
      <Head title="Entity Directory" image="" />
      <div className="flex flex-col items-center lg:items-start space-y-10 mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 bg-[white] dark:bg-[#080C20] font-RobotoMono w-screen sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1256px] text-slate-950 dark:text-white page-border-and-color">
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

        <div className="md:px-4 flex gap-4">
          <button
            className={`px-4 py-2 border-2 rounded-lg ${
              tab === 'all' && 'border-moon-orange text-moon-orange'
            }`}
            onClick={() => setTab('all')}
          >
            All
          </button>
          <button
            className={`px-4 py-2 border-2 rounded-lg ${
              tab === 'entities' && 'border-moon-orange text-moon-orange'
            }`}
            onClick={() => setTab('entities')}
          >
            Entities
          </button>
          <button
            className={`px-4 py-2 border-2 rounded-lg ${
              tab === 'citizens' && 'border-moon-orange text-moon-orange'
            }`}
            onClick={() => setTab('citizens')}
          >
            Citizens
          </button>
        </div>
        {isLoadingEntities && <p className="text-center">Loading...</p>}
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

// export async function getServerSideProps({ query }: any) {
//   const { type } = query
//   return {
//     props: {
//       type: type || 'all',
//     },
//   }
// }
