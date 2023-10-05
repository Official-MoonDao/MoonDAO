import { useNetworkMismatch } from '@thirdweb-dev/react'
import Metadata from '../Layout/Metadata'
import VerticalStar from '../assets/VerticalStar'

const NoAssets = ({ address, userAssets, loading }: any) => {
  const networkMistmatch = useNetworkMismatch()
  return (
    <div className="pt-10 md:pt-12 lg:pt-16 xl:pt-20 m flex flex-col items-center w-full md:pl-36 xl:pl-44 2xl:pl-52 pb-24 xl:pb-24 2xl:pb-48">
      <Metadata title="Sell" />
      <div className="flex flex-col items-center md:items-start w-full px-5">
        <h2 className="font-GoodTimes tracking-wide flex items-center text-3xl lg:text-4xl bg-clip-text text-transparent bg-gradient-to-br from-moon-gold to-indigo-100">
          Sell NFTs
          <span className="ml-2 lg:ml-4">
            <VerticalStar />
          </span>
        </h2>
        {!address && (
          <p className="text-center mt-10 lg:mt-12 opacity-80 text-lg md:text-left text-red-400 w-3/4">
            {'Please connect your wallet'}
          </p>
        )}
        {address && loading && (
          <p className="text-center mt-10 lg:mt-12 opacity-80 text-lg md:text-left text-red-400 w-3/4">
            {!loading ? 'Please connect your wallet' : 'Loading...'}
          </p>
        )}
        {networkMistmatch && (
          <p className="text-center mt-10 lg:mt-12 opacity-80 text-lg md:text-left text-red-400 w-3/4">
            {`The marketplace only supports NFTs on ${
              process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'Polygon' : 'Mumbai'
            }`}
          </p>
        )}
        {address && !networkMistmatch && !loading && !userAssets?.[0] && (
          <p className="text-center mt-10 lg:mt-12 opacity-80 text-lg md:text-left text-red-400 w-3/4">
            {
              "You don't have any approved NFTs to sell. Please buy an NFT from the marketplace or submit a collection."
            }
          </p>
        )}
      </div>
    </div>
  )
}

export default NoAssets
