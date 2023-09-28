import {
  AuctionListing,
  DirectListing,
} from '../../../../lib/marketplace/marketplace-utils'
import ArrowButton from '../../Layout/ArrowButton'
import SectionHeader from '../../Layout/SectionHeader'
import TrendingThumbnail from './TrendingThumbnail'

interface TrendingShowcaseProps {
  assets: DirectListing[] | AuctionListing[]
  validListings: DirectListing[]
  validAuctions: AuctionListing[]
}

export default function TrendingShowcase({
  assets,
  validListings,
  validAuctions,
}: TrendingShowcaseProps) {
  return (
    <div className="mt-14 md:mt-20 flex flex-col w-full items-center py-[10%] md:py-[5%] md:px-[2%] bg-[#251d2e] object-cover rounded-tl-[12vw] rounded-br-[12vw] lg:rounded-br-[10vw] lg:rounded-tl-[10vw]">
      <SectionHeader title={'Trending Assets'} />
      {/*
      Will show 4 components from Mobile up to LG screens, where it transforms into a grid
      Incoming data is being sliced before mapping
      */}
      <div className="mt-9 md:mt-12 flex flex-col items-center gap-12 lg:hidden">
        {assets &&
          assets
            .slice(assets.length < 4 ? -assets.length : 0, 4)
            .map((asset, i, arr) => (
              <TrendingThumbnail
                key={'trending-thumbnail-' + i}
                asset={asset}
                validListings={validListings}
                validAuctions={validAuctions}
                first={i < 1}
                last={i === arr.length - 1}
              />
            ))}
      </div>
      {/*Desktop grid, not slicing*/}
      <div className="hidden lg:mt-20 lg:grid lg:grid-cols-2 lg:grid-flow-row lg:gap-12 xl:grid-cols-3 xl:gap-20">
        {assets &&
          assets.map((asset, i) => (
            <TrendingThumbnail
              key={'trending-thumbnail-' + i}
              asset={asset}
              validListings={validListings}
              validAuctions={validAuctions}
              first={i === 0}
              last={i === assets.length - 1 && assets.length % 2 === 0} //check if last asset & even number of assets
            />
          ))}
      </div>
      <ArrowButton
        text="See all"
        position={'mt-9 lg:mt-12'}
        link={'/buy?filterType=trending'}
      />
    </div>
  )
}

const dummyData = [
  {
    name: 'Lorem Ipsum',
    img: '/trendingthumbnail.png',
    holders: 20,
    floor: 20000,
    number: 102,
    link: '/',
  },
  {
    name: 'Lorem Ipsum',
    img: '/trendingthumbnail2.png',
    holders: 20,
    floor: 20000,
    number: 102,
    link: '/',
  },
  {
    name: 'Lorem Ipsum',
    img: '/trendingthumbnail3.png',
    holders: 20,
    floor: 20000,
    number: 102,
    link: '/',
  },
  {
    name: 'Lorem Ipsum',
    img: '/trendingthumbnail4.png',
    holders: 20,
    floor: 20000,
    number: 102,
    link: '/',
  },
  {
    name: 'Lorem Ipsum',
    img: '/trendingthumbnail.png',
    holders: 20,
    floor: 20000,
    number: 102,
    link: '/',
  },
  {
    name: 'Lorem Ipsum',
    img: '/trendingthumbnail2.png',
    holders: 20,
    floor: 20000,
    number: 102,
    link: '/',
  },
  {
    name: 'Lorem Ipsum',
    img: '/trendingthumbnail3.png',
    holders: 20,
    floor: 20000,
    number: 102,
    link: '/',
  },
  {
    name: 'Lorem Ipsum',
    img: '/trendingthumbnail4.png',
    holders: 20,
    floor: 20000,
    number: 102,
    link: '/',
  },
  {
    name: 'Lorem Ipsum',
    img: '/trendingthumbnail.png',
    holders: 20,
    floor: 20000,
    number: 102,
    link: '/',
  },
]
