import useTranslation from 'next-translate/useTranslation'
import React, { useState } from 'react'
import { PROPOSALS_QUERY } from '../lib/dashboard/gql/proposalsGQL'
import { useGQLQuery } from '../lib/utils/hooks'
import ProposalList from '../components/dashboard/proposals/ProposalList'
import ProposalSkeletons from '../components/dashboard/proposals/ProposalSkeletons'
import Head from '../components/layout/Head'

export default function Proposals() {
  const [skip, setSkip] = useState(0)

  const { data, isLoading, error, update } = useGQLQuery(
    'https://hub.snapshot.org/graphql',
    PROPOSALS_QUERY,
    { skip }
  )

  function handleSkip(value: number) {
    setSkip(value)
  }

  const { t } = useTranslation('common')

  return (
    <div className="animate-fadeIn">
      <Head title={t('proposalsTitle')} description={t('proposalsDesc')} />
      {error || isLoading ? (
        <ProposalSkeletons />
      ) : (
        data && (
          <ProposalList
            data={data.proposals}
            skip={skip}
            setSkip={handleSkip}
            isLoading={isLoading}
          />
        )
      )}
    </div>
  )
}

// add locales for Proposals title and desc
