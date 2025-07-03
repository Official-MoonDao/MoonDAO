import Image from 'next/image'
import StandardButton from '../layout/StandardButton'

export default function Callout1() {
  return (
    <section 
      id="callout1-section" 
      className="min-h-screen xl:min-h-[120vh] 2xl:min-h-[140vh] flex items-end"
      style={{
        backgroundImage: 'url("/assets/Moon-Launch.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        id="callout1-container"
        className="z-20 relative w-full h-full flex items-end pb-10 md:pb-0"
      >
        <div
          id="content-container"
          className="compact-lg flex justify-start w-full p-5 md:p-5 lg:pl-0 lg:pr-10 lg:max-w-[1200px] mx-auto"
        >
          <div
            id="content"
            className="overflow-visible relative w-full text-left"
          >
            <h1 className="header flex overflow-visible flex-col text-4xl font-GoodTimes font-bold leading-none text-white max-w-[500px]">
              Bringing the Space Industry Onchain
            </h1>
            <p
              id="paragraph"
              className="pt-2 pb-5 text-white text-lg w-[100%] max-w-[500px]"
            >
              The Space Acceleration Network is an onchain startup society
              that connects space visionaries and organizations with the
              funding, tools, and support needed to turn bold ideas into
              reality.
            </p>
            <StandardButton
              backgroundColor="bg-white"
              textColor="text-black"
              hoverColor="bg-gray-200"
              borderRadius="rounded-tl-[10px] rounded-[2vmax]"
              link="/network"
              paddingOnHover="pl-5"
            >
              Explore the Network
            </StandardButton>
          </div>
        </div>
      </div>
    </section>
  )
}
