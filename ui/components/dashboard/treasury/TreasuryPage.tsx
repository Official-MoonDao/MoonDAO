import useTranslation from 'next-translate/useTranslation'
import { useAssets, useTransactions } from '../../../lib/dashboard/hooks'
import { errorToast } from '../../../lib/utils/errorToast'
import Head from '../../layout/Head'
import Header from '../../layout/Header'
import Line from '../../layout/Line'
import AssetSkeletons from './balance/AssetSkeletons'
import Assets from './balance/Assets'
import TreasuryBalance from './balance/TreasuryBalance'
import Transaction from './transactions/Transaction'
import TransactionSkeletons from './transactions/TransactionSkeletons'

export default function TreasuryPage() {
  const {
    transactions,
    isLoading: loadingTransactions,
    error: etherscanError,
  } = useTransactions()

  const {
    tokens,
    balanceSum,
    isLoading: loadingAssets,
    error: assetsError,
  } = useAssets()

  if (etherscanError)
    errorToast(
      'Connection with Etherscan failed. Contact MoonDAO if the problem persists 🚀'
    )

  // Implement allowed asset functionality or warning when asset wasn't approved
  // Pagination

  const { t } = useTranslation('common')

  return (
    <>
      <Head title="Treasury" />
      <div className="xl:flex xl:justify-around">
        {/*Assets Section*/}
        <section className="xl:w-[40%] xl:max-w-[600px]">
          {loadingAssets || !tokens[0] ? (
            <AssetSkeletons />
          ) : (
            <div id="dashboard-treasury-assets">
              <TreasuryBalance balance={balanceSum} />
              <Assets tokens={tokens} />
            </div>
          )}
          <a
            className="mt-10 inline-block font-Montserrat text-lg underline text-stronger-light hover:text-title-light dark:text-moon-gold hover:dark:text-stronger-dark"
            href="https://etherscan.io/address/0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9"
            target="_blank"
            rel="noreferrer"
          >
            View MoonDAO on Etherscan
          </a>
        </section>

        {/*Transactions Section*/}
        <section className="mt-12 xl:mt-2 xl:w-[40%] xl:max-w-[700px]">
          <div className="flex flex-row items-center justify-between">
            <Header text="Transactions" noStar />
          </div>

          <Line />
          <div className="mt-10">
            {loadingTransactions || !transactions ? (
              <TransactionSkeletons />
            ) : (
              <div id="dashboard-treasury-transactions">
                {transactions?.map((transaction: any, i: number) => (
                  <Transaction
                    key={transaction.hash + i}
                    data={transaction}
                    loading={loadingTransactions}
                  />
                ))}
              </div>
            )}
          </div>

          {/*Pagination Goes Here*/}
        </section>
      </div>
    </>
  )
}
