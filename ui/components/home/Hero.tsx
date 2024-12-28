import dynamic from 'next/dynamic'
import MailingList from '../layout/MailingList'
import Image from 'next/image'

const Earth = dynamic(() => import('@/components/globe/Earth'), { ssr: false })

export default function Hero({ citizenLocationData }: any) {
  return (
    <section id="hero-section" className="flex relative h-[100vh] w-full ">
      <div className="absolute left-0 top-0 z-0 h-full w-auto bg-gradient-to-r from-transparent via-[#2A41B5]/20 to-[#2A41B5] w-full">
        <Image
          src="/assets/hero-element.svg"
          alt="Hero background element"
          width={767}
          height={1517}
          priority
          className="h-full w-auto object-contain object-left-top"
        />
      </div>

      <div
        id="hero-container"
        className="compact-xxl w-full h-full flex flex-col justify-center items-end lg:items-start md:items-end md:pl-10 md:pr-10 pb-[20px] lg:pb-20 relative z-10"
      >
        <div
          id="featured-image-container"
          className="absolute h-[100%] left-0 top-0 w-[100%]"
        >
          {/* Extra Large Screens (1800px+) */}
          <div className="hidden 2xl:block absolute h-full right-0 top-0 w-[1200px] h-[1200px]">
            <Earth 
              pointsData={citizenLocationData} 
              enableControls={true}
              enableZoom={false}
            />
          </div>

          {/* Large Screens (1000px - 1800px) */}
          <div className="hidden xl:block 2xl:hidden absolute h-full right-0 top-0 w-[70vw]">
            <Earth 
              pointsData={citizenLocationData} 
              enableControls={true}
              enableZoom={false}
            />
          </div>

          {/* Mobile Landscape (576px - 1000px) */}
          <div className="hidden sm:block xl:hidden absolute h-full left-0 top-0 w-[70vw]">
            <Earth 
              pointsData={citizenLocationData} 
              enableControls={true}
              enableZoom={false}
              rotateOnMouseMove={true}
            />
          </div>

          {/* Mobile Portrait (below 576px) */}
          <div className="block sm:hidden absolute h-full left-0 top-0 w-[90vw]">
            <Earth 
              pointsData={citizenLocationData} 
              enableControls={false}
              enableZoom={false}
              rotateOnMouseMove={true}
            />
          </div>
        </div>

        <div
          id="content"
          className="relative mt-[100px] w-[100%] md:w-[95%] lg:w-[70%]"
          style={{ pointerEvents: 'none' }}
        >
          <h1
            id="header"
            className="flex flex-col font-GoodTimes leading-none text-4xl"
          >
            <span
              style={{ fontSize: 'calc(min(4.5vmin, 30px))' }}
              className="mt-[5vmax] mt-[150px]"
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
            MoonDAO is accelerating our multiplanetary future with a global
            network and open platform to fund, collaborate, and compete on
            challenges that get us closer to a lunar settlement.
          </p>
          <div style={{ pointerEvents: 'auto' }}>
            <MailingList />
          </div>
        </div>
      </div>
    </section>
  )
}
