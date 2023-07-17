import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import React from 'react'
import { useTransactions } from '../../lib/dashboard/hooks'
import { errorToast } from '../../lib/utils/errorToast'
import WalletTransactions from '../../components/dashboard/treasury/Transactions'
import Head from '../../components/layout/Head'
import flag from '../../public/Original.png'

export default function Treasury() {
  const { transactions, isLoading, error } = useTransactions()

  if (error)
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
          {!isLoading && transactions && (
            <WalletTransactions transactions={transactions} />
          )}
        </div>
      </div>
    </div>
  )
}

// add locales for Treasury title and desc
