import Image from 'next/image'
import MailingList from '../layout/MailingList'
import StandardButton from '../layout/StandardButton'
import Video from './Video'

export default function Hero() {
  return (
    <section id="hero-section" className="overflow-visible relative w-full">
      <div
        id="hero-container"
        className="flex flex-col md:h-[80vh] items-end justify-end lg:items-start lg:justify-end md:min-h-[90vmin] md:items-start px-[20px] md:px-[40px] 2xl:px-[80px] 3xl:px-[120px] min-h-[800px] mt-[-1px] p-5 pb-[140px] md:pb-[160px] lg:pb-[280px] xl:pb-[300px] 2xl:pb-[350px] 3xl:pb-[400px] lg:min-h-[800px] 2xl:min-h-[900px] 3xl:min-h-[1000px] relative z-10"
      >
        <div
          id="background"
          className="w-full h-full absolute top-0 right-0 overflow-hidden z-0 bg-cover bg-no-repeat"
          style={{backgroundImage: 'url("/assets/Lunar-Colony-Dark.png")', backgroundPosition: 'center 150%'}}
        ></div>
        <div
          id="tl-divider"
          className="absolute h-[90%] left-[-2px] top-0 w-[45%]"
        ></div>
        <div
          id="content"
          className="relative w-full max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto lg:pl-[80px] 2xl:pl-[100px] 3xl:pl-[120px]"
        >
          <div className="relative w-[100%] pt-0 md:w-[95%] lg:w-[70%] 2xl:w-[60%] 3xl:w-[55%]"
          >
          <h1
            id="header"
            className="flex flex-col font-GoodTimes leading-none text-4xl"
          >
            <span
              style={{ fontSize: 'calc(min(4.5vmin, 30px))' }}
              className="2xl:text-4xl 3xl:text-5xl"
            >
              The Internet's
            </span>
            <span
              style={{ fontSize: 'calc(max(12vmin, 30px))' }}
              className="mt-[1vmin] 2xl:text-8xl 3xl:text-9xl"
            >
              Space
            </span>
            <span
              style={{ fontSize: 'calc(max(9vmin, 30px))' }}
              className="mt-[1vmin] 2xl:text-7xl 3xl:text-8xl"
            >
              Program
            </span>
          </h1>
          <p
            id="paragraph-content"
            className="mr-5 max-w-[350px] pb-5 pt-2 text-lg w-full md:w-[100%] md:max-w-[350px] lg:max-w-[500px] 2xl:max-w-[600px] 2xl:text-xl 3xl:max-w-[700px] 3xl:text-2xl"
          >
            MoonDAO is an open platform to fund, collaborate, and compete on
            challenges that get us closer to a lunar settlement.
          </p>
          <StandardButton
            backgroundColor="bg-white"
            textColor="text-dark-cool"
            hoverColor="bg-mid-cool"
            borderRadius="rounded-tl-[10px] rounded-[2vmax]"
            link="/join"
            paddingOnHover="pl-5"
          >
            Join the Network
          </StandardButton>
          </div>
        </div>
      </div>
      <Video />
    </section>
  )
}
