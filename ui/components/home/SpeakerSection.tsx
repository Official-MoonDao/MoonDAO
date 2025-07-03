import Image from 'next/image'
import Link from 'next/link'
import FeaturedIn from '../home/FeaturedIn'
import Speaker from '../home/Speaker'

export default function SpeakerSection() {
  return (
    <section className="bg-white md:rounded-br-[0px] w-full min-h-[800px] md:h-[80vh] md:min-h-[90vmin] lg:min-h-[800px] 2xl:min-h-[900px] 3xl:min-h-[1000px] flex flex-col">
      <div
        id="speaker-section-container"
        className="px-8 md:px-12 lg:px-16 2xl:px-24 3xl:px-32 relative flex justify-center pt-4 lg:pt-6 xl:pt-8 2xl:pt-12 3xl:pt-16 flex-1"
      >
        <div
          id="speaker-section"
          className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] flex items-center flex-col"
        >
          <h2
            id="section-header"
            className="header font-GoodTimes text-center text-dark-cool mb-2 lg:mb-4 xl:mb-6 2xl:mb-8 3xl:mb-10 text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl 3xl:text-7xl"
          >
            Past Speakers
          </h2>
          <div
            id="speaker-container"
            className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mb-2 lg:mb-4 xl:mb-6 2xl:mb-8 3xl:mb-10"
          >
            <div
              id="speakers"
              className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-3 gap-x-4 gap-y-6 lg:gap-x-6 lg:gap-y-8 xl:gap-x-8 xl:gap-y-10 2xl:gap-x-10 2xl:gap-y-12 3xl:gap-x-12 3xl:gap-y-14 justify-items-center"
            >
              <Speaker
                alt="Charlie Duke"
                logo="/assets/Speaker-Charlie-Duke.png"
                name="Charlie Duke"
                subtitle="Apollo 16 Moonwalker, NASA Astronaut"
                link="https://www.youtube.com/watch?v=79dThcv3PdU"
              />
              <Speaker
                alt="Doug Hurley"
                logo="/assets/Speaker-Doug-Hurley.png"
                name="Doug Hurley"
                subtitle="NASA and SpaceX Astronaut"
                link="https://www.youtube.com/watch?v=JLXwyZIOy5k"
              />
              <Speaker
                alt="Nicole Stott"
                logo="/assets/Speaker-Nicole-Stott.png"
                name="Nicole Stott"
                subtitle="NASA Astronaut"
                link="https://www.youtube.com/watch?v=WwtP38hDSOc"
              />
              <Speaker
                alt="Robert Zubrin"
                logo="/assets/Speaker-Robert-Zubrin.png"
                name="Robert Zubrin"
                subtitle="Mars Society Founder"
                link="https://www.youtube.com/watch?v=_706XEfrWIo"
              />
              <Speaker
                alt="Steve Altemus"
                logo="/assets/Speaker-Steve-Altemus.png"
                name="Steve Altemus"
                subtitle="CEO, Intuitive Machines"
                link="https://www.youtube.com/watch?v=xVQE0HPbbHw"
              />
              <Speaker
                alt="Dr. Phil Metzger"
                logo="/assets/Speaker-Phil-Metzger.png"
                name="Dr. Phil Metzger"
                subtitle="Planetary Physicist"
                link="https://www.youtube.com/watch?v=jTt6wOJPTeQ"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
