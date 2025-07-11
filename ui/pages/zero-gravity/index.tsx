import Link from 'next/link'
import Container from '@/components/layout/Container'
import Head from '@/components/layout/Head'

export default function ZeroGravity() {
  return (
    <Container>
      <main className="animate-fadeIn">
        <Head title="Zero Gravity" />

        <div className="mt-3 lg:mt-10 w-[336px] sm:w-[400px] lg:w-full lg:max-w-[1080px] bg-gradient-to-b from-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-[2vmax] shadow-2xl">
          <div className="bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-[2vmax] px-5 lg:px-7 xl:px-10 py-12 lg:py-14 border border-slate-600/30">
            <h2 className="page-title flex text-white">Zero Gravity</h2>

            <div className="mt-3 lg:mt-4 font-Lato">
              <p className="mt-6 lg:mt-7 text-moon-orange font-RobotoMono inline-block w-full xl:text-lg">
                {`Fill out the form below to be contacted about future ticket sales.`}
              </p>
              <iframe
                className="mt-6 aspect-video object-cover w-full"
                src="https://www.youtube.com/embed/l8fFZtgBrIY?showinfo=0&controls=1&rel=0&mute=1&autoplay=1"
                allowFullScreen
              />
              <p className="mt-6 font-Lato text-base xl:text-lg text-white text-opacity-70">
                {`Welcome to MoonDAO's Astronaut Training Program. We've partnered with `}
                <Link
                  href="https://spaceforabetterworld.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="cursor-pointer text-moon-orange ease-in-ease-out duration-300"
                >
                  {'Space for a Better World '}
                </Link>
                {
                  'to bring these VIP training opportunities to people alongside experienced NASA astronauts. Our first flight out of Kennedy Space Center featured legendary Apollo 16 Moonwalker Charlie Duke, NASA and SpaceX astronaut Doug Hurley, and NASA astronaut Nicole Stott in zero gravity.'
                }
              </p>

              <p className="mt-6 font-Lato text-base xl:text-lg text-white text-opacity-70">
                {`The airplane flies in parabolic arcs to create a weightless environment, allowing you to float, flip, and soar as if you were in space. Start training for a journey to the Moon and experience the adventure of a lifetime with a zero gravity flight!`}
              </p>
            </div>

            <section className="mt-4 w-full flex flex-col items-start">
              {/* <PurchasePortal validVP={validVP} /> */}
              <h3 className="mt-4 font-bold text-2xl text-white">
                {'Contact:'}
              </h3>
              <p className="mt-6 font-Lato text-base xl:text-lg text-white text-opacity-70">
                {`Fill out the form below to get notified about ticket sales for future VIP training opportunities in zero gravity.`}
              </p>
              <div className="w-full flex justify-center">
                <iframe
                  className="mt-[-50px] w-full max-w-[550px] h-[550px]"
                  src="https://moondao.ck.page/1e6e54ca0a/"
                />
              </div>
            </section>
          </div>
        </div>
      </main>
    </Container>
  )
}
