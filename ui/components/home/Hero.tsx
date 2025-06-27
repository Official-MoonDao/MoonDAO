import Image from 'next/image'
import MailingList from '../layout/MailingList'
import StandardButton from '../layout/StandardButton'

export default function Hero() {
  return (
    <section id="hero-section" className="overflow-visible relative w-full">
      <div
        id="hero-container"
        className="flex flex-col md:h-[80vh] items-end justify-end lg:items-start lg:justify-end md:min-h-[90vmin] md:items-start px-[20px] md:px-[40px] min-h-[575px] mt-[-1px] p-5 pb-[80px] lg:pb-40 lg:min-h-[800px] relative z-10"
      >
        <div
          id="background"
          className="gradient-1 w-full h-full absolute top-0 right-0 rounded-bl-[2vmax] overflow-hidden z-0"
        ></div>
        <div
          id="tl-divider"
          className="divider-1 absolute h-[90%] left-[-2px] top-0 w-[45%]"
        ></div>
        <div
          id="featured-image-container"
          className="absolute h-[100%] left-0 overflow-hidden top-0 w-[100%]"
        >
          <div
            id="feature-below-1400"
            className="hide-xl absolute h-full mt-5 right-0 top-0 w-[80vmin] lg:w-[50vmax] md:w-[70%] max-[676px]:right-[50%] max-[676px]:translate-x-[50%]"
          >
            <Image
              src="/assets/feature-1.png"
              alt="Feature 1"
              width={675}
              height={675}
            />
          </div>
          <div
            id="feature-above-1200"
            className="show-xl absolute h-full mt-5 right-0 top-0 w-[850px]"
          >
            <Image
              src="/assets/feature-1.png"
              alt="Feature 1"
              width={850}
              height={850}
            />
          </div>
        </div>
        <div
          id="bottom-right-divider-below-1400"
          className="hide-xl absolute bottom-[-2px] h-full hidden md:block md:right-0 md:w-[80%] right-[-20%] w-[60%] lg:w-[60%]"
        >
          <Image
            className="absolute bottom-[-2px] right-0"
            src="/assets/divider-2.svg"
            alt="Divider 2"
            width={1000}
            height={1000}
          />
        </div>
        <div
          id="bottom-right-divider-above-1400"
          className="show-xl absolute bottom-[-2px] right-0 h-full w-[900px]"
        >
          <Image
            className="absolute bottom-[-2px] right-0"
            src="/assets/divider-2.svg"
            alt="Divider 2"
            width={900}
            height={900}
          />
        </div>
        <div
          id="content"
          className="relative w-full max-w-[1200px] mx-auto"
        >
          <div className="relative w-[100%] pt-0 md:w-[95%] lg:w-[70%]"
          >
          <h1
            id="header"
            className="flex flex-col font-GoodTimes leading-none text-4xl"
          >
            <span
              style={{ fontSize: 'calc(min(4.5vmin, 30px))' }}
              className="md:mt-[5vmax]"
            >
              The Internet's
            </span>
            <span
              style={{ fontSize: 'calc(max(12vmin, 30px))' }}
              className="mt-[1vmin]"
            >
              Space
            </span>
            <span
              style={{ fontSize: 'calc(max(9vmin, 30px))' }}
              className="mt-[1vmin]"
            >
              Program
            </span>
          </h1>
          <p
            id="paragraph-content"
            className="mr-5 max-w-[350px] pb-5 pt-2 text-lg w-full md:w-[100%] md:max-w-[350px] lg:max-w-[500px]"
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
    </section>
  )
}
