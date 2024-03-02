import { Polygon, Sepolia } from '@thirdweb-dev/chains'
import { ThirdwebNftMedia, useContract, useNFTs } from '@thirdweb-dev/react'
import { ENTITY_ADDRESSES } from 'const/config'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '../../lib/thirdweb/chain-context'
import { useEntityMetadata } from '@/lib/entity/useEntityMetadata'
import Head from '../../components/layout/Head'

function EntityCard({ metadata, owner }: { metadata: any; owner: string }) {
  return (
    <div>
      {metadata && (
        <div className="flex flex-col border-2 border-rose-500 rounded w-[340px] p-4">
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
      )}
    </div>
  )
}

export default function Entities() {
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  const { contract: entityContract } = useContract(
    ENTITY_ADDRESSES[selectedChain.slug]
  )

  const { data: nfts, isLoading, error } = useNFTs(entityContract)

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Sepolia
    )
  }, [])

  useEffect(() => {
    console.log(entityContract)
    console.log(nfts)
  }, [entityContract, nfts])

  return (
    <main className="animate-fadeIn">
      <Head title="Entity Directory" image="" />
      <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 bg-[#080C20] font-RobotoMono w-screen sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-full text-slate-950 dark:text-white">
        <h1 className={`page-title`}>Entity Directory</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 mt-5 gap-y-5 justify-evenly items-center justify-items-center place-items-center">
          {nfts?.concat(nfts).map((nft) => {
            if (nft.metadata.name !== 'Failed to load NFT metadata') {
              return (
                <div key={nft.metadata.id}>
                  <EntityCard metadata={nft.metadata} owner={nft.owner} />
                </div>
              )
            }
          })}
        </div>
      </div>
    </main>
  )
}
