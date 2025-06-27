import Image from 'next/image'
import Link from 'next/link'
import FeaturedIn from '../home/FeaturedIn'
import Speaker from '../home/Speaker'

export default function SpeakerSection() {
  return (
    <section className="bg-white rounded-tl-[5vmax] rounded-bl-[5vmax] rounded-br-[5vmax] md:rounded-br-[0px] pb-6 w-full">
      <div
        id="speaker-section-container"
        className="px-8 md:px-12 lg:px-16 relative flex justify-center"
      >
        <div
          id="speaker-section"
          className="w-full max-w-[1200px] pt-6 pb-3 flex items-center flex-col"
        >
          <h2
            id="section-header"
            className="header font-GoodTimes text-center text-dark-cool mb-4"
          >
            Past Speakers
          </h2>
          <div
            id="speaker-container"
            className="w-full max-w-[1200px] mb-0"
          >
            <div
              id="speakers"
              className="p-3 pt-0 grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 justify-items-center"
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
      <div
        id="youtube-callout-container"
        className="flex px-5 justify-center w-full max-w-[1200px] mx-auto"
      >
        <Link href="https://www.youtube.com/@officialmoondao?sub_confirmation=1">
          <div
            id="youtube-callout"
            className="inline-flex items-center justify-center group"
          >
            <div
              id="youtube-icon"
              className="transition-transform duration-300 group-hover:scale-110"
            >
              <Image
                src="/../assets/icon-youtube.svg"
                alt="Subscribe on YouTube"
                width="50"
                height="50"
              />
            </div>
            <div id="youtube-text">
              <p
                id="youtube-text"
                className="md:text-center px-5 leading-none font-GoodTimes text-dark-cool"
              >
                <span className="block md:inline">Subscribe &nbsp;</span>
                <span className="block md:inline">on YouTube</span>
              </p>
            </div>
          </div>
        </Link>
      </div>
    </section>
  )
}
