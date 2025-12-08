import Image from 'next/image'
import Button from '../layout/Button'
import MailingList from '../layout/MailingList'
import Video from './Video'

export default function Hero() {
  return (
    <section
      id="hero-section"
      className="overflow-x-hidden overflow-y-visible relative w-full min-h-screen"
    >
      <div
        id="hero-container"
        className="flex flex-col min-h-screen items-end justify-end lg:items-start lg:justify-end md:items-start px-[20px] md:px-[40px] 2xl:px-[80px] 3xl:px-[120px] mt-[-1px] p-5 pb-[100px] md:pb-[120px] lg:pb-[200px] xl:pb-[240px] 2xl:pb-[280px] 3xl:pb-[320px] relative z-10 mx-auto"
      >
        <div
          id="background"
          className="w-full h-full absolute top-0 right-0 overflow-hidden z-0 pointer-events-none"
        >
          <Image
            src="/assets/Lunar-Colony-Dark.webp"
            alt="Lunar Colony Background"
            fill
            priority
            className="object-cover object-center"
            style={{ objectPosition: 'center 80%' }}
            sizes="100vw"
          />
        </div>
        <div id="tl-divider" className="absolute h-[90%] left-[-2px] top-0 w-[45%]"></div>
        <div
          id="content"
          className="relative w-full lg:w-[50%] 2xl:w-[45%] 3xl:w-[50%] lg:pl-[80px] 2xl:pl-[100px] 3xl:pl-[120px] flex flex-col justify-center min-h-[400px]"
        >
          <div className="relative w-[100%] pt-0 mb-8 md:mb-12 lg:mb-16">
            <h1 id="header" className="flex flex-col font-GoodTimes leading-none text-4xl">
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
              MoonDAO is an open platform to fund, collaborate, and compete on challenges that get
              us closer to a lunar settlement.
            </p>

            <div className="flex items-start justify-start min-h-[60px] mb-4 relative z-20">
              <Button
                variant="secondary"
                className="bg-white hover:bg-gray-100"
                textColor="text-black"
                borderRadius="rounded-tl-[10px] rounded-[2vmax]"
                link="/join"
                paddingOnHover="pl-5"
              >
                Join the Network
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Video />
    </section>
  )
}
