import Image from 'next/image'
import StandardButton from '../layout/StandardButton'
import BrandLogo from './BrandLogo'

export default function Callout1() {
  return (
    <section id="callout1-section" className="bg-dark-warm md:bg-transparent">
      <div
        id="callout1-container"
        className="md:rounded-bl-[5vmax] z-20 relative w-[100%] h-[100%] bg-white mt-[-2vmax] pt-[2vmax] pb-0 lg:pb-10"
      >
        <div
          id="content-container"
          className="compact-lg flex flex-col-reverse justify-end lg:flex-row items-start lg:items-center min-h-[250px] md:min-h-[400px] px-5 pt-10 pb-0 md:p-10 md:pb-0 md:pt-10 lg:max-w-[1200px]"
        >
          <div
            id="featured-image"
            className=" compact-lg hide-lg lg:min-h-[450px] mt-5 md:mr-10 w-[100%] h-[250px] md:h-[70vmax] lg:h-[60vh]"
          >
            <Image
              src="/assets/feature-2.png"
              alt="Feature 2"
              width={1000}
              height={1000}
            />
          </div>
          <div
            id="content"
            className="overflow-visible relative flex flex-col items-center md:items-start w-[100%]"
          >
            <h1 className="header flex text-center md:text-left overflow-visible flex-col text-4xl font-GoodTimes font-bold bg-clip-text text-dark-cool bg-gradient-to-r from-red-500 to-blue-500 leading-none">
              Bringing the Space Industry Onchain
            </h1>
            <p
              id="paragraph"
              className="text-center md:text-left pt-2 pb-5 text-black text-lg w-[100%] max-w-[500px]"
            >
              The Space Acceleration Network is an onchain startup society
              focused on building a permanent settlement on the Moon and beyond.
              We aim to connect space visionaries and organizations with the
              funding, tools, and support needed to turn bold ideas into
              reality.
            </p>
            <StandardButton
              backgroundColor="bg-dark-cool"
              textColor="text-white"
              hoverColor="bg-mid-cool"
              borderRadius="rounded-tl-[10px] rounded-[2vmax]"
              link="/map"
              paddingOnHover="pl-5"
            >
              Explore the Network
            </StandardButton>
          </div>
        </div>

        {/* Partner Logos Section */}
        <div className="w-full pb-10 px-5 flex items-center flex-col max-w-[1200px]">
          <div className="w-full max-w-[1200px] m-5 mb-0">
            <div className="flex flex-row flex-wrap justify-center">
              <BrandLogo
                alt="Blue Origin Logo"
                logo="./../assets/logo-blue-origin.svg"
                link="/network"
              />
              <BrandLogo
                alt="Intuitive Machines Logo"
                logo="./../assets/logo-intuitive-machines.svg"
                link="/network"
              />
              <BrandLogo
                alt="Earthlight Foundation Logo"
                logo="./../assets/logo-earthlight-foundation.svg"
                link="/network"
              />
              <BrandLogo
                alt="OpenLunar Logo"
                logo="./../assets/logo-openlunar.svg"
                link="/network"
              />           
              <BrandLogo
                alt="Lifeship Logo"
                logo="./../assets/logo-lifeship.svg"
                link="/network"
              />
              <BrandLogo
                alt="Desci Labs Logo"
                logo="./../assets/logo-desci-labs.svg"
                link="/network"
              />
              <BrandLogo
                alt="CryoDAO Logo"
                logo="./../assets/logo-cryodao.svg"
                link="/network"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
