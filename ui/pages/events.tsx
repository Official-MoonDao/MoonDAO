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
            <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {!events?.[0] ? (
                  <>
                    {Array(6)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          key={`event-skeleton-${i}`}
                          className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-lg min-h-[140px] flex flex-col justify-center items-center"
                        >
                          <div className="animate-pulse space-y-3 w-full">
                            <div className="h-4 bg-white/20 rounded w-3/4 mx-auto"></div>
                            <div className="h-3 bg-white/10 rounded w-1/2 mx-auto"></div>
                            <div className="h-3 bg-white/10 rounded w-2/3 mx-auto"></div>
                          </div>
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
