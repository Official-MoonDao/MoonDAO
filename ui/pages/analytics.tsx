import React from 'react' // Add React import
import useTranslation from 'next-translate/useTranslation'
import AnalyticsPage from '../components/dashboard/analytics/AnalyticsPage'
import TreasuryPage from '../components/dashboard/treasury/TreasuryPage'
import Head from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter' // Import NoticeFooter
import Container from '@/components/layout/Container' // Import Container
import ContentLayout from '@/components/layout/ContentLayout' // Import ContentLayout

export default function Analytics() {
  const { t } = useTranslation('common')

  const title = t('analyticsTitle') // Use translation for title
  const description = t('analyticsDesc') // Use translation for description
  const image = '/assets/moondao-og.jpg' // Add image path

  return (
    <>
      <Head title={title} description={description} image={image} /> 
      <Container> 
        <ContentLayout
          header={title} 
          description={description} 
          preFooter={<NoticeFooter />} 
          mainPadding
          isProfile
          mode="compact"
        >
          <div className="flex flex-col justify-center items-center w-full gap-16 pb-10">
            <AnalyticsPage />
            <TreasuryPage />
          </div>
        </ContentLayout>
      </Container>
    </>
  )
}

// add locales for Analytics title and desc
