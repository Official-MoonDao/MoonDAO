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
            description={<div className="max-w-2xl">{t('bridgeDesc')}</div>}
            preFooter={<NoticeFooter />}
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
