import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import React from 'react'
import { useAssets, useTransactions } from '../../lib/dashboard/hooks'
import { errorToast } from '../../lib/utils/errorToast'
import AssetSkeletons from '../../components/dashboard/treasury/balance/AssetSkeletons'
import Assets from '../../components/dashboard/treasury/balance/Assets'
import TreasuryBalance from '../../components/dashboard/treasury/balance/TreasuryBalance'
import Transaction from '../../components/dashboard/treasury/transactions/Transaction'
import TransactionSkeletons from '../../components/dashboard/treasury/transactions/TransactionSkeletons'
import Head from '../../components/layout/Head'
import Header from '../../components/layout/Header'
import Line from '../../components/layout/Line'

export default function Treasury() {
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
    <main className="animate-fadeIn">
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
              <div id="dashboard-treasury-transactions">{
              transactions?.map((transaction: any, i: number) => (
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
    </main>
  )
}

// add locales for Treasury title and desc
