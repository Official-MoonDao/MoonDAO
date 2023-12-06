import useTranslation from 'next-translate/useTranslation'
import AnalyticsPage from '../components/dashboard/analytics/AnalyticsPage'
import TreasuryPage from '../components/dashboard/treasury/TreasuryPage'
import Head from '../components/layout/Head'

export default function Analytics() {
  const { t } = useTranslation('common')

  return (
    <div
      className={`mt-3 lg:mt-10 animate-fadeIn relative lg:flex lg:flex-col lg:items-center xl:block
      `}
    >
      <Head title={t('analyticsTitle')} description={t('analyticsDesc')} />

      <div className="flex flex-col justify-center items-center w-full gap-16 page-border-and-color pb-10">
        <AnalyticsPage />
        <TreasuryPage />
      </div>
    </div>
  )
}

// add locales for Analytics title and desc
