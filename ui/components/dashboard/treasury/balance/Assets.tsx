import { allowedAssets } from '../../../../lib/dashboard/dashboard-utils.ts/asset-config'
import ArticleTitle from '../../../layout/ArticleTitle'
import Asset from './Asset'

const Assets = ({ tokens }: any) => {
  return (
    <section className="flex flex-col">
      {tokens
        .filter((token: any) => allowedAssets[token.symbol])
        .map((token: any, i: number) => (
          <Asset
            key={i}
            name={token.symbol}
            amount={token.balance
              .toFixed(2)
              .toString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            usd={token.usd
              .toFixed(2)
              .toString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            address={token.address}
          />
        ))}
    </section>
  )
}

export default Assets
