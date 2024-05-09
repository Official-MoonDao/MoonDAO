import useTranslation from 'next-translate/useTranslation'
import { useCalendarEvents } from '../lib/dashboard/hooks'
import { DiscordEvent } from '../components/dashboard/calendar/DiscordEvent'
import { SeshEvent } from '../components/dashboard/calendar/SeshEvent'
import Head from '../components/layout/Head'

const SESH_LINK = 'https://sesh.fyi/api/calendar/v2/hfwjLhfVoutWs65KegtbP7.ics'

export default function Events() {
  const events = useCalendarEvents(SESH_LINK)

  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title={t('eventsTitle')} description={t('eventsDesc')} />
      <div className="mt-3 px-5 lg:px-7 xl:px-9 py-12 lg:py-14 lg:mt-10 page-border-and-color w-[336px] sm:w-[400px] lg:w-full lg:max-w-[1080px]">
        {/*Title*/}
        <h2 className="page-title">Events</h2>
        {/*Section containing the events*/}
        <section className="mt-6 inner-container-background py-5 px-2 lg:px-4 xl:px-6 font-RobotoMono">
          <p className="p-2 text-base lg:text-lg xl:text-[20px] font-medium text-light-text dark:text-white">
            {t('eventsDesc')}
          </p>
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
    </div>
  )
}

// add locales for Calendar title and desc
