import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Arbitrum, ArbitrumSepolia, Sepolia } from '@thirdweb-dev/chains'
import {
  NFT,
  ThirdwebNftMedia,
  useContract,
  useNFTs,
} from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES, ENTITY_ADDRESSES } from 'const/config'
import { approvedCitizens, approvedEntities } from 'const/whitelist'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import Head from '../components/layout/Head'
import { SearchIcon } from '@/components/assets'

function EntityCitizenCard({
  metadata,
  owner,
  type,
}: {
  metadata: any
  owner: string
  type: string
}) {
  return (
    <div>
      {metadata && (
        <Link
          href={`/${type === 'entity' ? 'entity' : 'citizen'}/${metadata.id}`}
          passHref
        >
          <div className="p-4 flex flex-col rounded w-[310px] h-[600px] dark:bg-[#080C30] hover:scale-105 ease-in-out duration-300 justify-between">
            <ThirdwebNftMedia
              className=""
              metadata={metadata}
              height={'280px'}
              width={'280px'}
            />
            <p className="mt-3 text-black dark:text-white text-2xl">
              {metadata.name}
            </p>
            <p className="flex items-center text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg">
              {owner.slice(0, 6) + '...' + owner.slice(-4)}
            </p>
            <p className="mt-3 h-[100px] text-md text-ellipsis overflow-hidden">
              {metadata.description || ''}
            </p>

            <div className="flex flex-row space-x-5">
              <button
                disabled={true}
                className="px-4 py-2 text-[grey] rounded-full bg-[#e7e5e7] bg-opacity-10 flex items-center"
              >
                {type === 'entity' ? 'Entity' : 'Citizen'}
              </button>
              <button
                disabled={true}
                className="px-4 py-2 text-blue-500 rounded-full bg-blue-400 bg-opacity-10 flex items-center"
              >
                ID: {metadata.id}
              </button>
            </div>
          </div>
        </Link>
      )}
    </div>
  )
}

export default function Directory() {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  const [tab, setTab] = useState('entities')
  function loadByTab(tab: string) {
    if (tab === 'entities') {
      setCachedNFTs(filteredEntities)
    } else if (tab === 'citizens') {
      setCachedNFTs(filteredCitizens)
    } else {
      setCachedNFTs([...filteredEntities, ...filteredCitizens])
    }
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
    if (tab === 'entities') setMaxPage(Math.ceil(totalEntities?.toNumber() / 9))
    if (tab === 'citizens') setMaxPage(Math.ceil(totalCitizens?.toNumber() / 9))
    if (tab === 'all')
      setMaxPage(
        Math.ceil((totalEntities.toNumber() + totalCitizens.toNumber()) / 9)
      )
  }, [totalEntities, totalCitizens, tab])

  const [cachedNFTs, setCachedNFTs] = useState<NFT[]>([])

  const [input, setInput] = useState('')

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
    loadByTab(tab)
  }, [tab, filteredEntities, filteredCitizens])

  useEffect(() => {
    if (input !== '') {
      setCachedNFTs(
        cachedNFTs.filter((nft) => {
          return nft.metadata.name
            ?.toString()
            .toLowerCase()
            .includes(input.toLowerCase())
        })
      )
    } else {
      loadByTab(tab)
    }
  }, [input, cachedNFTs])

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

          <button
            className={`px-4 py-2 border-2 rounded-lg ${
              tab === 'all' && 'border-moon-orange text-moon-orange'
            }`}
            onClick={() => setTab('all')}
          >
            All
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
