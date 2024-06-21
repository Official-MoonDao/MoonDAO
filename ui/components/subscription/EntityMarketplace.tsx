import Image from 'next/image'
import { useState } from 'react'
import Button from './Button'
import Card from './Card'
import SubCard from './SubCard'

function ListingModal({ setEnabled }: any) {
  const [stage, setStage] = useState(0)

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-marketplace-modal-backdrop')
          setEnabled(false)
      }}
      id="entity-marketplace-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      {' '}
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <p className="text-2xl">List on Marketplace</p>
        {stage === 0 && <div className="flex flex-col gap-2"></div>}
      </div>
    </div>
  )
}

function CollectionCard({ name, description, image = '', floorPrice }: any) {
  return (
    <SubCard className="flex flex-col gap-4">
      <Image
        className="w-[200px] md:w-full"
        src={image}
        width={200}
        height={200}
        alt=""
      />
      <p className="font-bold h-[25px]">{name}</p>

      <p className="h-[150px] overflow-auto pr-2">{description}</p>
      <p className="font-bold">{`Floor Price: ${floorPrice}`}</p>
    </SubCard>
  )
}

export default function EntityMarketplace({ entityId }: any) {
  const [listingModalEnabled, setListingModalEnabled] = useState(false)

  return (
    <Card>
      <p className="text-2xl">Marketplace</p>
      <div className="mt-4 max-h-[600px] overflow-auto flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {entityId === '0' && (
          <>
            <CollectionCard
              name="Lunar Cargo Transport"
              description="Ensure your payloads reach the lunar surface safely and efficiently with our Lunar Cargo Transport service, designed for a variety of commercial and scientific needs.
"
              image="/dummy/marketplace/lunar-cargo-transport.png"
              floorPrice="150 ETH"
            />
            <CollectionCard
              name="Lunar Regolith Purchase"
              description="Acquire high-quality lunar regolith for research and industrial applications on Earth. Perfect for studies in lunar geology or developing new construction materials.
"
              image="/dummy/marketplace/lunar-regolith.png"
              floorPrice="10 ETH"
            />
            <CollectionCard
              name="Data Sets"
              description="Obtain comprehensive lunar data sets, including detailed maps, mineral compositions, and geological surveys, to support your research and mission planning.
"
              image="/dummy/marketplace/lunar-data-sets.png"
              floorPrice="1 ETH"
            />
          </>
        )}
        {entityId === '1' && (
          <>
            <CollectionCard
              name="Customized Workshops and Training"
              description="Provide customized workshops and training sessions tailored to schools, universities, and research institutions, focusing on specific areas of space science, technology, and open-source methodologies.
"
              image="/dummy/marketplace/customized-workshops-and-training.png"
              floorPrice="2 ETH"
            />
            <CollectionCard
              name="Open-Source Software Tools"
              description="Develop and distribute open-source software tools for space research, such as simulation programs, data analysis tools, and mission planning software, available for free to the global community."
              image="/dummy/marketplace/open-source-software-tools.png"
              floorPrice="0.01 ETH"
            />
            <CollectionCard
              name="Open Data Access Subscriptions"
              description="Offer subscription-based access to an extensive open data repository, providing researchers with valuable datasets, including satellite imagery, lunar maps, and astrophysical data.
"
              image="/dummy/marketplace/open-data-access.png"
              floorPrice="1 ETH"
            />
          </>
        )}
        {entityId === '2' && (
          <>
            <CollectionCard
              name="Annual Space Exploration (ASEC) Conference Tickets"
              description="Join the foremost event in space exploration by attending our Annual Space Exploration Conference. This conference features keynote speakers from the space industry, panel discussions, workshops, and networking opportunities. It’s the perfect platform to connect with industry leaders, researchers, and enthusiasts.
"
              image="/dummy/marketplace/asec-tickets.png"
              floorPrice="0.2 ETH"
            />
            <CollectionCard
              name="Universal Space Alliance Shirt"
              description="Show your support for space exploration with our exclusive merchandise. From apparel and accessories to collectibles and educational materials, our store offers a variety of items that allow you to represent your passion for space.
"
              image="/dummy/marketplace/universal-space-tshirt.png"
              floorPrice="0.01 ETH"
            />
            <CollectionCard
              name="Space Tours and Experiences"
              description="Experience space like never before with our exclusive tours and experiences. Packages may include VIP tours of space facilities, zero-gravity flights, and meetings with astronauts and space experts. These unique experiences offer an insider’s view into the world of space exploration.
"
              image="/dummy/marketplace/exclusive-space-tours.png"
              floorPrice="10 ETH"
            />
          </>
        )}
      </div>
      {listingModalEnabled && <ListingModal setEnabled={listingModalEnabled} />}
      <Button className="mt-4" onClick={() => setListingModalEnabled(true)}>
        Create a Listing
      </Button>
    </Card>
  )
}
