import Link from 'next/link'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function ZeroGravity() {
  return (
    <>
      <Head title="Zero Gravity" />
      <div className="w-full">
        <ContentLayout
          header="Zero Gravity Training"
          headerSize="max(20px, 3vw)"
          description="Experience astronaut training like never before. We've partnered with Space for a Better World to bring VIP zero gravity training opportunities alongside experienced NASA astronauts, including legendary Apollo 16 Moonwalker Charlie Duke."
          preFooter={
            <NoticeFooter
              defaultImage="../assets/MoonDAO-Logo-White.svg"
              defaultTitle="Join the Mission"
              defaultDescription="Be part of the Space Acceleration Network and play a role in establishing a permanent human presence on the Moon and beyond."
              defaultButtonText="Learn More"
              defaultButtonLink="/join"
              imageWidth={200}
              imageHeight={200}
            />
          }
          mainPadding
          isProfile
          mode="compact"
          popOverEffect={false}
        >
            <div className="space-y-8">
              <div className="font-Lato">
                <p className="text-moon-orange font-RobotoMono text-lg mb-6">
                  Fill out the form below to be contacted about future ticket sales.
                </p>
                
                <iframe
                  className="aspect-video object-cover w-full rounded-lg"
                  src="https://www.youtube.com/embed/l8fFZtgBrIY?showinfo=0&controls=1&rel=0&mute=1&autoplay=1"
                  allowFullScreen
                />
                
                <p className="mt-6 text-base xl:text-lg text-white text-opacity-70">
                  Welcome to MoonDAO's Astronaut Training Program. We've partnered with{' '}
                  <Link
                    href="https://spaceforabetterworld.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer text-moon-orange hover:text-moon-orange/80 transition-colors duration-300"
                  >
                    Space for a Better World
                  </Link>
                  {' '}to bring these VIP training opportunities to people alongside experienced NASA astronauts. Our first flight out of Kennedy Space Center featured legendary Apollo 16 Moonwalker Charlie Duke, NASA and SpaceX astronaut Doug Hurley, and NASA astronaut Nicole Stott in zero gravity.
                </p>

                <p className="mt-6 text-base xl:text-lg text-white text-opacity-70">
                  The airplane flies in parabolic arcs to create a weightless environment, allowing you to float, flip, and soar as if you were in space. Start training for a journey to the Moon and experience the adventure of a lifetime with a zero gravity flight!
                </p>
              </div>

              <section className="w-full">
                <h3 className="font-bold text-2xl text-white mb-6">
                  Contact
                </h3>
                <p className="text-base xl:text-lg text-white text-opacity-70 mb-6">
                  Fill out the form below to get notified about ticket sales for future VIP training opportunities in zero gravity.
                </p>
                <div className="w-full flex justify-center">
                  <iframe
                    className="w-full max-w-[550px] h-[550px] rounded-lg"
                    src="https://moondao.ck.page/1e6e54ca0a/"
                  />
                </div>
              </section>
            </div>
          </ContentLayout>
        </div>
    </>
  )
}
