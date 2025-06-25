import { DISCORD_GUILD_ID } from 'const/config'
import useTranslation from 'next-translate/useTranslation'
import { DiscordEvent } from '../components/dashboard/calendar/DiscordEvent'
import WebsiteHead from '../components/layout/Head'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function Events({ events }: any) {
  const { t } = useTranslation('common')

  return (
    <>
      <WebsiteHead title={t('eventsTitle')} description={t('eventsDesc')} />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={t('eventsTitle')}
            headerSize="max(20px, 3vw)"
            description={t('eventsDesc')}
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
            <div className="mt-3 w-full flex grid grid-cols-1 lg:grid-cols-2 gap-4 md:mb-[5vw] 2xl:mb-[2vw]">
              {!events?.[0] ? (
                <>
                  {Array(6)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={`event-skeleton-${i}`}
                        className="p-4 bg-darkest-cool flex flex-col w-full items-center gap-2 font-RobotoMono text-center lg:text-left lg:items-start lg:px-4"
                      >
                        <h1 className="font-bold text-light-warm lg:text-lg xl:text-[20px]">
                          {'...Loading'}
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
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

export async function getStaticProps() {
  const eventsRes = await fetch(
    `https://discord.com/api/v8/guilds/${DISCORD_GUILD_ID}/scheduled-events`,
    {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    }
  )

  const events = await eventsRes.json()

  return {
    props: {
      events,
    },
    revalidate: 60,
  }
}
