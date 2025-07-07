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
            {/* Luma Events Iframe */}
            <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl mb-8">
              <h2 className="text-2xl font-bold text-white mb-4 text-center">Upcoming Events</h2>
              <div className="w-full relative">
                <div id="luma-loading" className="absolute inset-0 bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p className="text-sm">Loading events...</p>
                  </div>
                </div>
                <iframe
                  src="https://lu.ma/embed/calendar/cal-7mKdy93TZVlA0Xh/events?lt=dark"
                  width="100%"
                  height="600"
                  frameBorder="0"
                  style={{ border: '1px solid #bfcbda88', borderRadius: '4px' }}
                  allowFullScreen
                  aria-hidden="false"
                  tabIndex={0}
                  className="rounded-lg relative z-10"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="MoonDAO Events Calendar"
                  onLoad={(e) => {
                    const loadingDiv = document.getElementById('luma-loading');
                    if (loadingDiv) {
                      loadingDiv.style.display = 'none';
                    }
                  }}
                />
                {/* Fallback link */}
                <div className="mt-4 text-center">
                  <p className="text-white/70 text-sm mb-2">
                    Can't see the calendar? 
                  </p>
                  <a 
                    href="https://lu.ma/moondao" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
                  >
                    View events on lu.ma
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Discord Events */}
            <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-4 text-center">Upcoming Launches</h2>
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
