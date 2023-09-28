import CollectionPreview from './CollectionPreview'

// I copied the map to give an example of how the grid will look like
export default function CollectionGrid({
  collections,
  validListings,
  validAuctions,
}: any) {
  return (
    <section className="mt-10 md:mt-16 flex flex-col gap-10 md:grid md:grid-cols-2 md:grid-flow-row md:gap-12 xl:grid-cols-3 xl:gap-14">
      {collections &&
        collections[0] &&
        collections.map((c: any, i: number) => (
          <CollectionPreview
            key={i + c.assetContract}
            collection={c}
            validListings={validListings}
            validAuctions={validAuctions}
          />
        ))}
    </section>
  )
}
