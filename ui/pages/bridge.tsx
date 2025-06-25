import useTranslation from 'next-translate/useTranslation'
import React from 'react'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function Bridge() {
  const { t } = useTranslation('common')

  return (
    <>
      <WebsiteHead title={t('bridgeTitle')} description={t('bridgeDesc')} />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={t('bridgeTitle')}
            headerSize="max(20px, 3vw)"
            description={t('bridgeDesc')}
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
            mainPadding
            isProfile
            mode="compact"
            popOverEffect={false}
          >
            <div className="mt-3 w-full max-w-2xl">
              <ArbitrumBridge />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
