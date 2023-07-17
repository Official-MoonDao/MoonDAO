import Asset from './Asset'
import TreasuryBalance from './TreasuryBalance'

const AssetSkeletons = () => {
  const skeletonData = {
    name: 'Loading',
    amount: 'Loading',
    usd: 'Loading',
  }

  return (
    <>
      <TreasuryBalance loading balance="100.000.000" />
      {Array(6)
        .fill(skeletonData)
        .map((e, i) => (
          <Asset loading key={i} name={e.name} amount={e.amount} usd={e.usd} />
        ))}
    </>
  )
}

export default AssetSkeletons
