import useTranslation from 'next-translate/useTranslation'
import { useCalendarEvents } from '../lib/dashboard/hooks'
import { DiscordEvent } from '../components/dashboard/calendar/DiscordEvent'
import Head from '../components/layout/Head'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

const SESH_LINK = 'https://sesh.fyi/api/calendar/v2/hfwjLhfVoutWs65KegtbP7.ics'

export default function Events() {
  const events = useCalendarEvents(SESH_LINK)
  const { t } = useTranslation('common')

  return (
    <>
      <Head title={t('eventsTitle')} description={t('eventsDesc')} />
      <Container>
        <ContentLayout
          header="Events"
          headerSize="max(20px, 3vw)"
          description={t('eventsDesc')}
          preFooter={<NoticeFooter />}
          mainPadding
          isProfile
          mode="compact"
          popOverEffect={false}
        >
          <div className="animate-fadeIn">
            <section className="pb-10 px-2 lg:px-4 xl:px-6 font-RobotoMono">
              <div
                id="scheduled-events"
                className="mt-5 flex flex-col gap-4 items-center"
              >
                {/*Skeleton while loading*/}
                {!events?.[0] ? (
                  <>
                    {Array(6)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          className="flex flex-col w-full items-center gap-2 p-2 py-5 font-RobotoMono border dark:border-white dark:border-opacity-20 text-center lg:text-left lg:items-start lg:px-4 animate-pulse"
                          key={'seshEvent' + i}
                        >
                          <h1 className="text-indigo-500 dark:text-moon-orange lg:text-lg xl:text-[20px] min-h-12">
                            ...Loading
                          </h1>
                        </div>
                      ))}
                  </>
                ) : (
                  <>
                    {events.map((event: any) => (
                      <DiscordEvent key={event.id} discordEvent={event} />
                    ))}
                  </>
                )}
              </div>
            </section>
          </div>
        </ContentLayout>
      </Container>
    </>
  )
}

// add locales for Calendar title and desc

