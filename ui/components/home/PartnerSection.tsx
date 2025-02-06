import Link from 'next/link'
import TeamTier from '../onboarding/TeamTier'
import BrandLogo from './BrandLogo'

export default function PartnerSection() {
  return (
    <>
      <section
        id="network-section-container"
        className="mt-5 flex justify-start bg-white rounded-br-[5vmax] md:rounded-br-[0vmax] rounded-tl-[5vmax] rounded-bl-[5vmax] mb-5"
      >
        <div
          id="network-section"
          className=" w-full py-10 px-5 flex items-center flex-col max-w-[1200px]"
        >
          <h2
            id="section-header"
            className="header font-GoodTimes text-center text-dark-cool"
          >
            Our Network
          </h2>
          <div
            id="network-container"
            className="w-full max-w-[1200px] m-5 mb-0"
          >
            <div
              id="teams"
              className="flex flex-row flex flex-row flex-wrap justify-center"
            >
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
      </section>

      <section
        id="featured-section-container"
        className="flex justify-start bg-white rounded-tl-[5vmax] rounded-tr-[5vmax] md:rounded-tr-[0vmax]"
      >
        <div
          id="feature-section"
          className=" w-full pt-10 px-5 pb-5 flex items-center flex-col max-w-[1200px]"
        >
          <h2
            id="section-header"
            className="header font-GoodTimes text-center text-dark-cool"
          >
            As Featured On
          </h2>
          <div
            id="Network-container"
            className="w-full max-w-[1200px] m-5 mb-0"
          >
            <div
              id="teams"
              className="p-5 pt-0 flex flex-row flex flex-row flex-wrap justify-center"
            >
              <BrandLogo
                alt="Read about MoonDAO on Space.com"
                logo="/../assets/logo-spacedotcom.svg"
                link="https://www.space.com/blue-origin-eiman-jahangir-suborbital-flight-moondao"
              />
              <BrandLogo
                alt="Read about MoonDAO on Forbes"
                logo="/../assets/logo-forbes.svg"
                link="https://www.forbes.com/sites/zengernews/2022/11/09/the-crypto-community-thats-going-to-the-moonliterally/?sh=119bc18670f0"
              />
              <BrandLogo
                alt="Read about MoonDAO on VICE"
                logo="/../assets/logo-vice.svg"
                link="https://www.vice.com/en/article/4aw4wj/investors-in-moondao-think-theyll-go-to-space-on-a-billionaires-rocket"
              />
              <BrandLogo
                alt="Read about MoonDAO on CNET"
                logo="/../assets/logo-cnet.svg"
                link="https://www.cnet.com/science/space/moondao-will-pick-2-of-the-next-blue-origin-astronauts-with-the-help-of-nfts/"
              />
              <BrandLogo
                alt="Read about MoonDAO in the Houston Chronicle"
                logo="/../assets/logo-houston-chronicle.svg"
                link="https://www.houstonchronicle.com/news/houston-texas/space/article/cryptocurrency-blockchain-space-overlap-17753964.php"
              />
              <BrandLogo
                alt="Read about MoonDAO on Phys.org"
                logo="/../assets/logo-phys.svg"
                link="https://phys.org/news/2022-08-co-founder-texas-based-dude-space.html"
              />
              <BrandLogo
                alt="Read about MoonDAO on MSN"
                logo="/../assets/logo-msn.svg"
                link="https://www.msn.com/en-us/money/other/representation-matters-vanderbilt-doctor-to-become-first-nashvillian-to-go-outer-space/ar-AA1oRGNM?ocid=BingNewsVerp"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
