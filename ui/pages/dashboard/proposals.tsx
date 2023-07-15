import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { PROPOSALS_QUERY } from '../../lib/dashboard/gql/proposalsGQL'
import { errorToast } from '../../lib/utils/errorToast'
import { useGQLQuery } from '../../lib/utils/hooks/useGQLQuery'
import ProposalList from '../../components/dashboard/proposals/ProposalList'
import Head from '../../components/layout/Head'
import flag from '../../public/Original.png'

export default function Proposals() {
  const [skip, setSkip] = useState(0)
  const { data, isLoading, error, update } = useGQLQuery(
    'https://hub.snapshot.org/graphql',
    PROPOSALS_QUERY,
    { skip }
  )

  function handleSkip(value: number) {
    setSkip(value)
    update()
  }

  if (error)
    errorToast(
      'Connection failed. Contact MoonDAO discord if the problem persists 🚀'
    )

  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title="Proposals" />
      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
          {t('proposalsTitle')}
          <Image src={flag} width={36} height={36} />
        </h1>

        <p className="mb-8 font-RobotoMono">{t('proposalsDesc')}</p>

        <div className="grid xl:grid-cols-1 mt-2 gap-8">
          {!isLoading && data && (
            <ProposalList
              data={data.proposals}
              skip={skip}
              setSkip={handleSkip}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// add locales for Proposals title and desc
