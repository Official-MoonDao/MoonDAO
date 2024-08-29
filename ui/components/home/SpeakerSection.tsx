import Speaker from '../home/Speaker'; 
import FeaturedIn from '../home/FeaturedIn';
import Image from 'next/image';
import Link from 'next/link';

export default function SpeakerSection() {
  return ( 
    <section className="bg-white rounded-tl-[5vmax] rounded-bl-[5vmax] rounded-br-[5vmax] md:rounded-br-[0px] pb-10">
      <div id="speaker-section-container" 
        className="px-2 md:px-5 relative flex justify-start"
        >
        <div id="speaker-section" 
          className=" w-full pt-10 pb-5 flex items-center flex-col max-w-[1200px]"
          >
          <h2 id="section-header" 
            className="header font-GoodTimes text-center text-dark-cool">Friends Of MoonDAO
          </h2>
          <div id="speaker-container"
            className="w-full max-w-[1200px] m-5 mb-0"
            >  
            <div id="speakers"
              className="p-5 pt-0 flex flex-row flex flex-row flex-wrap justify-around"
              >
              <Speaker 
                alt="Charlie Duke" 
                logo="/../assets/Speaker-Charlie-Duke.png"
                name="Charlie Duke"
                subtitle="NASA Astronaut"
                link="https://www.youtube.com/watch?v=lcKy3l4-LkE&t=1s" 
              />                
              <Speaker
                alt="Doug Hurley" 
                logo="/../assets/Speaker-Doug-Hurley.png" 
                name="Doug Hurley"
                subtitle="NASA Astronaut"
                link="https://www.youtube.com/watch?v=JLXwyZIOy5k"
              />
              <Speaker 
                alt="Nicole Stott" 
                logo="/../assets/Speaker-Nicole-Stott.png"
                name="Nicole Stott"
                subtitle="NASA Astronaut"
                link="https://www.youtube.com/watch?v=WwtP38hDSOc&t=18s" 
              />
              <Speaker
                alt="Robert Zubrin"
                logo="/../assets/Speaker-Robert-Zubrin.png"
                name="Robert Zubrin"
                subtitle="Mars Society Founder"
                link="https://www.youtube.com/watch?v=_706XEfrWIo"
              />
              <Speaker
                alt="Steve Altemus"
                logo="/../assets/Speaker-Steve-Altemus.png"
                name="Steve Altemus"
                subtitle="CEO, Intuitive Machines"
                link="https://www.youtube.com/watch?v=xVQE0HPbbHw"
              />
              <Speaker
                alt="Dr.Phil Metzger"
                logo="/../assets/Speaker-Phil-Metzger.png"
                name="Dr.Phil Metzger"
                subtitle="Planetary Physicist"
                link="https://www.youtube.com/watch?v=jTt6wOJPTeQ"
              />
              </div>
            </div> 
          </div>       
      </div>
      <div id="youtube-callout-container" 
        className="flex px-5 justify-center max-w-[1200px]"
        >
        <Link href="https://www.youtube.com/@officialmoondao">
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
                alt="Follow MoonDAO on YouTube"
                width="50"
                height="50"
              />
            </div>
            <div id="youtube-text">
            <p id="youtube-text" 
              className="md:text-center px-5 leading-none font-GoodTimes text-dark-cool"
              >
              <span className="block md:inline">
                Follow MoonDAO &nbsp;
              </span>
              <span className="block md:inline">
                on YouTube
              </span>
            </p>
            </div>
          </div>
        </Link>
      </div>
    </section>
  )
}
