import { LockClosedIcon } from '@heroicons/react/24/outline'
import { useAddress } from '@thirdweb-dev/react'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import React from 'react'
import Head from '../components/layout/Head'
import HomeCard from '../components/layout/HomeCard'
import flag from '../public/Original.png'

export default function Home() {
  const address = useAddress()
  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title="Home" />

      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
          {t('indexTitle')}
          <Image src={flag} width={36} height={36} />
        </h1>

        <p className="mb-8 font-RobotoMono">{t('indexDesc')}</p>

        <div className="grid xl:grid-cols-1 mt-2 gap-8">
          <HomeCard
            href="/lock"
            icon={
              <LockClosedIcon className="h-5 w-5 absolute right-8 text-n3blue" />
            }
            title={t('getVMOONEY')}
            linkText={t('getVMOONEY')}
          >
            <p>{t('indexCard')}</p>
          </HomeCard>
          {address && <h1>{'hello  ' + address}</h1>}
        </div>
      </div>
    </div>
  )
}
