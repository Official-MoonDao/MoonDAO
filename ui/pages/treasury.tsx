import useTranslation from 'next-translate/useTranslation'
import React from 'react'
import TreasuryPage from '../components/dashboard/treasury/TreasuryPage'
import Head from '../components/layout/Head'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function Treasury({ dateUpdated }: any) {
  const { t } = useTranslation('common')

  const descriptionSection = (
    <div className="flex flex-col gap-2">
      {
        "Detailed and transparent analytics on treasury holdings, transaction history, and more to stay informed about MoonDAO's financial health."
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
    <section id="treasury-container" className="overflow-hidden">
      <Head
        title="Treasury"
        description="Detailed and transparent analytics on MoonDAO's treasury holdings, transaction history, and more."
      />

      <Container>
        <ContentLayout
          header="Treasury"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={
            <NoticeFooter
              defaultImage="../assets/MoonDAO-Logo-White.svg"
              defaultTitle="Need Help?"
              defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
              defaultButtonText="Submit a Ticket"
              defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
              imageWidth={200}
              imageHeight={200}
            />
          }
          mainPadding={false}
          mode="compact"
          popOverEffect={false}
          isProfile
          contentwide
        >
          <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="grid gap-6 xl:grid-cols-1 lg:w-full lg:max-w-[1380px] items-center justify-center">
              <TreasuryPage />
            </div>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  try {
    const today = new Date()
    const formattedDate = `${today.getFullYear()}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`

    return {
      props: {
        dateUpdated: formattedDate,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    return {
      props: { dateUpdated: '' },
    }
  }
}
