import useTranslation from 'next-translate/useTranslation'
import React from 'react'
import { getVMOONEYData } from '@/lib/tokens/ve-subgraph'
import AnalyticsPage from '../components/dashboard/analytics/AnalyticsPage'
import TreasuryPage from '../components/dashboard/treasury/TreasuryPage'
import Head from '../components/layout/Head'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function Analytics({ vMooneyData, dateUpdated }: any) {
  const { t } = useTranslation('common')

  const descriptionSection = (
    <div className="flex flex-col gap-2">
      {
        'Key stats and insights around our governance token $MOONEY, including voting power distribution and locking stats. Dive into detailed and transparent analytics on treasury holdings, transaction history, and more to stay informed.'
      }
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
          <div className="grid gap-4 lg:gap-0 xl:grid-cols-1 mt-6 lg:mt-10 lg:w-full lg:max-w-[1380px] items-center justify-center">
            <AnalyticsPage vMooneyData={vMooneyData} />
            <TreasuryPage />
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  try {
    const vMooneyData = await getVMOONEYData()

    const today = new Date()
    const formattedDate = `${today.getFullYear()}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`

    return {
      props: {
        vMooneyData,
        dateUpdated: formattedDate,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    return {
      props: { vMooneyData: [], dateUpdated: '' },
    }
  }
}
