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

  const { t } = useTranslation('common')
  //Some margin left added on md screen size to compensate for change in layout
  return (
    <>
      <div
        id={'dashboard-treasury-page'}
        className="px-3 2xl:flex 2xl:items-baseline 2xl:justify-around gap-12 2xl:gap-20"
      >
        {/*Assets Section*/}
        <section className="2xl:w-[50%] 2xl:max-w-[700px]">
          <h2 className='title-text-colors text-4xl font-GoodTimes text-center 2xl:text-left'>Treasury</h2>
          <div className='mt-6 h-[1px] dark:bg-white bg-black opacity-20 w-full'></div>
          {loadingAssets || !tokens[0] ? (
            <AssetSkeletons />
          ) : (
            <div className='mt-4 xl:mt-7' id="dashboard-treasury-assets">
              <TreasuryBalance balance={balanceSum} />
              <Assets tokens={tokens} />
            </div>
          )}
          <a
            className="mt-10 inline-block w-full text-lg text-center underline dark:text-white text-gray-900"
            href="https://etherscan.io/address/0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9"
            target="_blank"
            rel="noreferrer"
          >
            View MoonDAO on Etherscan
          </a>
        </section>

        {/*Transactions Section*/}
        <section className="mt-12 xl:mt-2 2xl:w-[50%] 2xl:max-w-[700px]">
        <h2 className='title-text-colors text-3xl sm:text-4xl font-GoodTimes text-center 2xl:text-left'>Transactions</h2>

        <div className='mt-6 h-[1px] dark:bg-white bg-black opacity-20 w-full'></div>

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

          {/*Going through the transactions to check if some involve suspicious assets, if there is show the explanation*/}
          {transactions?.filter(
            (transaction: any) => allowedAssets[transaction.tokenSymbol]
          ).length < 10 && <TransactionDisclaimer />}

          {/*Pagination*/}
          <div className="mt-10 flex justify-between 2xl:w-full items-center">
            {/*Left Caret*/}
            <TransactionCaret
              left
              page={page}
              pageMax={pageMax}
              setPage={setPage}
              isLoaded={loadingTransactions}
            />

            {/*Page Buttons*/}
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

            {/*Right Caret*/}
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
