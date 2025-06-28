import Image from 'next/image'
import MailingList from '../layout/MailingList'
import StandardButton from '../layout/StandardButton'

export default function Hero() {
  return (
    <section id="hero-section" className="overflow-visible relative w-full">
      <div
        id="hero-container"
        className="flex flex-col md:h-[80vh] items-end justify-end lg:items-start lg:justify-end md:min-h-[90vmin] md:items-start px-[20px] md:px-[40px] min-h-[575px] mt-[-1px] p-5 pb-[120px] lg:pb-60 lg:min-h-[800px] relative z-10"
      >
        <div
          id="background"
          className="w-full h-full absolute top-0 right-0 overflow-hidden z-0 bg-cover bg-no-repeat"
          style={{backgroundImage: 'url("https://sdmntprnorthcentralus.oaiusercontent.com/files/00000000-24ac-622f-91f1-7216e8ada7cb/raw?se=2025-06-28T05%3A29%3A55Z&sp=r&sv=2024-08-04&sr=b&scid=2a7d17cc-e6e0-554a-ba8b-f2088f491576&skoid=e9d2f8b1-028a-4cff-8eb1-d0e66fbefcca&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-06-27T20%3A53%3A12Z&ske=2025-06-28T20%3A53%3A12Z&sks=b&skv=2024-08-04&sig=y61yWthSWUwNH3S5EiPRlk50vmCylCtZDtewzSBFFQs%3D")', backgroundPosition: 'center 150%'}}
        ></div>
        <div
          id="tl-divider"
          className="absolute h-[90%] left-[-2px] top-0 w-[45%]"
        ></div>
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
              className=""
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
