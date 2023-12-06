import { allowedAssets } from '../../../../lib/dashboard/dashboard-utils.ts/asset-config'
import ArticleTitle from '../../../layout/ArticleTitle'
import Asset from './Asset'

const Assets = ({ tokens }: any) => {
  return (
    <section className="mt-8 flex flex-col">
      <h3 className='title-text-colors text-2xl font-RobotoMono text-center 2xl:text-left'>DAO Assets</h3>

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
