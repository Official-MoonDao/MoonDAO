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
import flag from '../../public/Original.png'

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

  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title="Treasury" />
      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
          {t('treasuryTitle')}
          <Image src={flag} width={36} height={36} />
        </h1>

        <p className="mb-8 font-RobotoMono">{t('treasuryDesc')}</p>

        <div className="grid xl:grid-cols-1 mt-2 gap-8">
          <div>
            {loadingAssets || !tokens[0] ? (
              <AssetSkeletons />
            ) : (
              <>
                <TreasuryBalance balance={balanceSum} />
                <Assets tokens={tokens} />
              </>
            )}
          </div>
          <div>
            {loadingTransactions || !transactions ? (
              <TransactionSkeletons />
            ) : (
              transactions?.map((transaction: any, i: number) => (
                <Transaction
                  key={transaction.hash + i}
                  data={transaction}
                  loading={loadingTransactions}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// add locales for Treasury title and desc
