import useTranslation from 'next-translate/useTranslation'
import { useState } from 'react'
import { allowedAssets } from '../../../lib/dashboard/dashboard-utils.ts/asset-config'
import { useAssets, useTransactions } from '../../../lib/dashboard/hooks'
import AssetSkeletons from './balance/AssetSkeletons'
import Assets from './balance/Assets'
import TreasuryBalance from './balance/TreasuryBalance'
import Transaction from './transactions/Transaction'
import TransactionCaret from './transactions/TransactionCaret'
import TransactionDisclaimer from './transactions/TransactionDisclaimer'
import TransactionPagination from './transactions/TransactionPagination'
import TransactionSkeletons from './transactions/TransactionSkeletons'

function Frame(props: any) {
  return (
    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-lg w-full transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full">
        {props.children}
      </div>
    </div>
  )
}

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

  const { t } = useTranslation('common')
  //Some margin left added on md screen size to compensate for change in layout
  return (
    <Frame>
      {/*Assets Section*/}
      <section className="flex flex-col h-full">
        <div className="flex-shrink-0">
          <h2 className="text-white text-3xl lg:text-4xl font-GoodTimes">Treasury</h2>
          <div className="mt-4 h-[1px] bg-white/20 w-full"></div>
        </div>
        
        <div className="flex-1 flex flex-col justify-between mt-6">
          <div className="flex-1 space-y-0">
            {loadingAssets || !tokens[0] ? (
              <AssetSkeletons />
            ) : (
              <div id="dashboard-treasury-assets">
                <TreasuryBalance balance={balanceSum} />
                <Assets tokens={tokens} />
              </div>
            )}
          </div>
          
          <div className="flex-shrink-0 mt-8">
            <a
              className="inline-block w-full text-base text-center underline text-blue-200 hover:text-blue-100 transition-colors duration-300"
              href="https://etherscan.io/address/0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9"
              target="_blank"
              rel="noreferrer"
            >
              View MoonDAO on Etherscan
            </a>
          </div>
        </div>
      </section>

      {/*Transactions Section*/}
      <section className="flex flex-col h-full">
        <div className="flex-shrink-0">
          <h2 className="text-white text-3xl lg:text-4xl font-GoodTimes">
            Transactions
          </h2>
          <div className="mt-4 h-[1px] bg-white/20 w-full"></div>
        </div>

        <div className="flex-1 flex flex-col justify-between mt-6">
          <div className="flex-1 space-y-0">
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
            
            {/*Going through the transactions to check if some involve suspicious assets*/}
            {transactions?.filter(
              (transaction: any) => allowedAssets[transaction.tokenSymbol]
            ).length < 10 && <TransactionDisclaimer />}
          </div>

          {/*Pagination*/}
          <div className="flex-shrink-0 mt-8">
            <div className="flex justify-between items-center">
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
                ? [pageMax - 4, pageMax - 3, pageMax - 2, pageMax - 1, pageMax].map(
                    (e, i) => (
                      <TransactionPagination
                        key={i}
                        currentPage={page}
                        pageNumber={e}
                        setPage={setPage}
                        pageMax={pageMax}
                        isLoaded={loadingTransactions}
                      />
                    )
                  )
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
          </div>
        </div>
      </section>
    </Frame>
  )
}
