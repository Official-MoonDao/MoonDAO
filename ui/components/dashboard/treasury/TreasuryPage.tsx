import useTranslation from 'next-translate/useTranslation'
import {useState} from 'react'
import { useAssets, useTransactions } from '../../../lib/dashboard/hooks'
import { errorToast } from '../../../lib/utils/errorToast'
import Head from '../../layout/Head'
import Header from '../../layout/Header'
import Line from '../../layout/Line'
import AssetSkeletons from './balance/AssetSkeletons'
import Assets from './balance/Assets'
import TreasuryBalance from './balance/TreasuryBalance'
import Transaction from './transactions/Transaction'
import TransactionCaret from './transactions/TransactionCaret'
import TransactionPagination from './transactions/TransactionPagination'
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

    const [page, setPage] = useState(1);
    const pageMax = 697;
    console.log(page)

  // Implement allowed asset functionality or warning when asset wasn't approved

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
