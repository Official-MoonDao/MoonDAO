import Image from 'next/image'
import StandardButton from '../layout/StandardButton'

export default function Callout1() {
  return (
    <section 
      id="callout1-section" 
      className="min-h-[800px] md:h-[80vh] md:min-h-[90vmin] lg:min-h-[800px] 2xl:min-h-[900px] 3xl:min-h-[1000px] flex items-end relative"
    >
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/Moon-Launch.webp"
          alt="Moon Launch Background"
          fill
          className="object-cover object-center-bottom"
          sizes="100vw"
        />
      </div>
      <div
        id="callout1-container"
        className="z-20 relative w-full h-full flex items-end pb-[20px] md:pb-[40px] lg:pb-[60px] xl:pb-[80px] 2xl:pb-[120px] 3xl:pb-[160px] max-w-[2400px] mx-auto"
      >
        <div
          id="content-container"
          className="compact-lg flex justify-start w-full p-5 md:pr-10 md:pl-10 2xl:pr-20 2xl:pl-20 3xl:pr-32 3xl:pl-32 max-w-[2400px] mx-auto"
        >
          <div
            id="content"
            className="overflow-visible relative w-full lg:w-[50%] 2xl:w-[45%] 3xl:w-[50%] text-left lg:pl-[80px] 2xl:pl-[100px] 3xl:pl-[120px]"
          >
            <div className="w-full">
              <h1 className="header flex overflow-visible flex-col text-4xl 2xl:text-6xl 3xl:text-7xl font-GoodTimes font-bold leading-none text-white max-w-[500px] 2xl:max-w-[800px] 3xl:max-w-[900px]">
                Bringing the Space Industry Onchain
              </h1>
              <p
                id="paragraph"
                className="pt-2 pb-5 text-white text-lg 2xl:text-xl 3xl:text-2xl max-w-[500px] 2xl:max-w-[600px] 3xl:max-w-[700px] text-left"
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
      </div>
    </section>
  )
}
