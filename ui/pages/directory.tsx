import { Polygon, Sepolia } from '@thirdweb-dev/chains'
import {
  NFT,
  ThirdwebNftMedia,
  useContract,
  useContractRead,
  useNFTs,
} from '@thirdweb-dev/react'
import { ENTITY_ADDRESSES } from 'const/config'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import Head from '../components/layout/Head'
import { ArrowLeft, ArrowSide, SearchIcon } from '@/components/assets'

function EntityCard({ metadata, owner }: { metadata: any; owner: string }) {
  return (
    <div>
      {metadata && (
        <Link href={`/entity/${metadata.id}`}>
          <div className="flex flex-col rounded w-[340px] bg-[#080C30] p-4">
            <ThirdwebNftMedia
              className="self-center"
              metadata={metadata}
              height={'280px'}
              width={'280px'}
            />
            <p className="mt-3 text-white text-2xl">{metadata.name}</p>
            <p className="flex items-center text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg">
              {owner.slice(0, 6) + '...' + owner.slice(-4)}
            </p>
            <p className="mt-3 h-[100px] text-md text-ellipsis overflow-hidden">
              {metadata.description || ''}
            </p>
            {/* <p className="mt-3 h-[100px] text-md text-ellipsis overflow-hidden">
            {
              'Qorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis.'
            }
          </p> */}
            <div className="flex flex-row space-x-5 mt-3">
              <button
                disabled={true}
                className="px-4 py-2 text-amber-300 rounded-full bg-yellow-100 bg-opacity-10 flex items-center"
                //   onClick={() =>
                //     window.open(
                //       'https://sepolia.etherscan.io/address/' + ENTITY_ADDRESSES
                //     )
                //   }
              >
                {'Ethereum'}
              </button>
              <button
                disabled={true}
                className="px-4 py-2 text-blue-500 rounded-full bg-blue-400 bg-opacity-10 flex items-center"
                //   onClick={() =>
                //     window.open(
                //       'https://sepolia.etherscan.io/address/' +
                //         ENTITY_ADDRESSES
                //     )
                //   }
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

export default function Entities() {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  )

  const { data: totalNFTs } = useContractRead(entityContract, 'totalSupply')

  const [maxPage, setMaxPage] = useState(1)

  useEffect(() => {
    // setMaxPage(Math.ceil(totalNFTs?.toNumber() / 9))
    setMaxPage(10)
  }, [totalNFTs])

  const [cachedNFTs, setCachedNFTs] = useState<NFT[]>([])

  const [input, setInput] = useState('')

  const {
    data: nfts,
    isLoading,
    error,
  } = useNFTs(entityContract, { start: 0, count: 100 })

  const [pageIdx, setPageIdx] = useState(1)

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Sepolia
    )
  }, [])

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
    } else if (nfts) {
      setCachedNFTs(nfts)
    }
  }, [input, cachedNFTs, nfts])

  console.log(input)
  return (
    <main className="animate-fadeIn">
      <Head title="Entity Directory" image="" />
      <div className="space-y-10 mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 bg-[#080C20] font-RobotoMono w-screen sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1256px] text-slate-950 dark:text-white">
        <h1 className={`page-title`}>Directory</h1>
        <div className="w-1/2 h-[30px] flex-row flex space-x-5">
          <SearchIcon />
          <input
            className="w-full rounded-md px-2 dark:bg-[#ffffff25]"
            onChange={({ target }) => setInput(target.value)}
            value={input}
            type="text"
            name="search"
            placeholder="Search..."
          />
        </div>
        {isLoading && <p className="text-center">Loading...</p>}
        <div
          className="grid grid-cols-1
        lg:grid-cols-2 xl:grid-cols-3 mt-5 gap-y-5 justify-evenly items-center justify-items-center place-items-center"
        >
          {cachedNFTs?.slice((pageIdx - 1) * 9, pageIdx * 9).map((nft) => {
            if (nft.metadata.name !== 'Failed to load NFT metadata') {
              return (
                <div key={nft.metadata.id}>
                  <EntityCard metadata={nft.metadata} owner={nft.owner} />
                </div>
              )
            }
          })}
        </div>
        <div className="flex flex-row justify-center space-x-10">
          <button
            onClick={() => {
              if (pageIdx > 1) {
                setPageIdx(pageIdx - 1)
              }
            }}
          >
            <ArrowLeft />
          </button>

          <p>{pageIdx}</p>
          <button
            onClick={() => {
              if (pageIdx < maxPage) {
                setPageIdx(pageIdx + 1)
              }
            }}
          >
            <ArrowSide />
          </button>
        </div>
      </div>
    </main>
  )
}
