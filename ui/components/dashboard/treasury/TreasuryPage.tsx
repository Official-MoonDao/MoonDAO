import useTranslation from 'next-translate/useTranslation'
import { useState } from 'react'
import { allowedAssets } from '../../../lib/dashboard/dashboard-utils.ts/asset-config'
import { useAssets, useTransactions } from '../../../lib/dashboard/hooks'
import { errorToast } from '../../../lib/utils/errorToast'
import Header from '../../layout/Header'
import Line from '../../layout/Line'
import AssetSkeletons from './balance/AssetSkeletons'
import Assets from './balance/Assets'
import TreasuryBalance from './balance/TreasuryBalance'
import Transaction from './transactions/Transaction'
import TransactionCaret from './transactions/TransactionCaret'
import TransactionDisclaimer from './transactions/TransactionDisclaimer'
import TransactionPagination from './transactions/TransactionPagination'
import TransactionSkeletons from './transactions/TransactionSkeletons'

export default function TreasuryPage() {
  const [page, setPage] = useState(1)
  const pageMax = 697

  const {
    transactions,
    isLoading: loadingTransactions,
    error: etherscanError,
  } = useTransactions(page)

  const {
    tokens,
    balanceSum,
    isLoading: loadingAssets,
    error: assetsError,
  } = useAssets()

  //This one is now misfiring all the time, commenting out for now.
  /**if (etherscanError)
    errorToast(
      'Connection with Etherscan failed. Contact MoonDAO if the problem persists 🚀'
    )
    */

  // Implement allowed asset functionality or warning when asset wasn't approved

  const { t } = useTranslation('common')
  //Some margin left added on md screen size to compensate for change in layout
  return (
    <>
      <div id={"dashboard-treasury-page"} className="md:ml-10 lg:flex lg:flex-col lg:items-center xl:flex-row xl:items-baseline xl:justify-around gap-12 xl:gap-16 2xl:gap-24">
        {/*Assets Section*/}
        <section className="xl:w-[40%] 2xl:w-[45%] xl:max-w-[600px]">
          <Header text={'Treasury'} />
          <Line />
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
        <section className="mt-12 xl:mt-2 xl:w-[40%] 2xl:w-[50%] xl:max-w-[700px]">
          <Header text={'Transactions'} noStar />
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

          {/*Going through the transactions to check if there is a filtered one, if there is show the explanation for that page*/}
          {transactions?.filter(
            (transaction: any) => allowedAssets[transaction.tokenSymbol]
          ).length < 10 && <TransactionDisclaimer />}

          {/*Pagination*/}
          <div className="mt-10 flex justify-between max-w-[650px] items-center">
            <TransactionCaret
              left
              page={page}
              pageMax={pageMax}
              setPage={setPage}
              isLoaded={loadingTransactions}
            />
            {page <= 3
              ? [1, 2, 3, 4, 5].map((e, i) => (
                  <TransactionPagination
                    key={i}
                    currentPage={page}
                    pageNumber={e}
                    setPage={setPage}
                    pageMax={pageMax}
                    isLoaded={loadingTransactions}
                  />
                ))
              : page >= pageMax - 2
              ? [
                  pageMax - 4,
                  pageMax - 3,
                  pageMax - 2,
                  pageMax - 1,
                  pageMax,
                ].map((e, i) => (
                  <TransactionPagination
                    key={i}
                    currentPage={page}
                    pageNumber={e}
                    setPage={setPage}
                    pageMax={pageMax}
                    isLoaded={loadingTransactions}
                  />
                ))
              : [page - 2, page - 1, page, page + 1, page + 2].map((e, i) => (
                  <TransactionPagination
                    key={i}
                    currentPage={page}
                    pageNumber={e}
                    setPage={setPage}
                    pageMax={pageMax}
                    isLoaded={loadingTransactions}
                  />
                ))}
            <TransactionCaret
              page={page}
              pageMax={pageMax}
              setPage={setPage}
              isLoaded={loadingTransactions}
            />
          </div>
        </section>
      </div>
    </>
  )
}
