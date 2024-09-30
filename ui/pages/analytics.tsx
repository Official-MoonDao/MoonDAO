import useTranslation from 'next-translate/useTranslation'
import React from 'react'
import { useEffect, useState } from 'react'
import AnalyticsPage from '../components/dashboard/analytics/AnalyticsPage'
import TreasuryPage from '../components/dashboard/treasury/TreasuryPage'
import Head from '../components/layout/Head'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function Analytics() {
  const { t } = useTranslation('common')

  const [dateUpdated, setDateUpdated] = useState<string>('')

  const descriptionSection = (
    <div className="h-[50px] p-2 flex gap-2 items-center">
      {'Figures updated as of '}
      {dateUpdated ? (
        <span className="font-bold">{dateUpdated}</span>
      ) : (
        <div className="ml-4 w-[20px]">
          <LoadingSpinner />
        </div>
      )}
    </div>
  )

  return (
    <section id="jobs-container" className="overflow-hidden">
      <Head title={t('analyticsTitle')} description={t('analyticsDesc')} />

      <Container>
        <ContentLayout
          header="Analytics"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="grid gap-4 lg:gap-0 xl:grid-cols-1 mt-6 lg:px-16 lg:mt-10 lg:w-full lg:max-w-[1380px] items-center justify-center">
            <AnalyticsPage setDateUpdated={setDateUpdated} />
            <TreasuryPage />
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

// add locales for Analytics title and desc
