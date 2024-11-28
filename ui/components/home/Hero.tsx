import dynamic from 'next/dynamic'
const Earth = dynamic(() => import('@/components/globe/Earth'), { ssr: false })
import MailingList from '../layout/MailingList'
import { dummyData } from 'const/dummyMapData'

export default function Hero() {
  return (
    <section id="hero-section"
      className="overflow-visible relative w-full"
      >
      <div id="hero-container" 
        className="compact-xxl flex flex-col h-[80vh] items-end justify-end lg:items-start lg:justify-end md:min-h-[90vmin] md:items-start md:pl-10 md:pr-10 min-h-[675px] mt-[-1px] p-5 pb-[80px] lg:pb-40 relative z-10"
        >
        <div id="featured-image-container" 
          className="absolute h-[100%] left-0 overflow-hidden top-0 w-[100%]"
          >
          <div id="map-container-below-1400" 
            className="branded hide-xl absolute h-full mt-0 left-0 top-0 w-[80vmin] lg:w-[50vmax] md:w-[70%]"
          >
            <Earth 
              pointsData={dummyData} 
              enableControls={true}
              fixedView={false}
            />
          </div>
          <div id="map-container-above-1400" 
            className="branded show-xl absolute h-full mt-[-10vh] right-0 top-0 w-[850px]"
          >
            <Earth 
              pointsData={dummyData}
              enableControls={true}
              fixedView={false}
            />
          </div>
        </div>  


        <div id="content" 
          className="relative w-[100%] pt-0 md:w-[95%] lg:w-[70%]"
          >
          <h1 id="header" 
            className="flex flex-col font-GoodTimes leading-none text-4xl"
            >
            <span 
              style={{fontSize: 'calc(min(4.5vmin, 30px))'}} 
              className="mt-[5vmax]"
              >
              The Internet's 
            </span>
            <span 
              style={{fontSize: 'calc(max(12vmin, 30px))'}} 
              className="mt-[1vmin]"
              >
              Space 
            </span>
            <span 
              style={{fontSize: 'calc(max(9vmin, 30px))'}} 
              className="mt-[1vmin]"
              >
              Program
            </span>
          </h1>
          <p id="paragraph-content" 
            className="mr-5 max-w-[350px] pb-5 pt-2 text-lg w-full md:w-[100%] md:max-w-[350px] lg:max-w-[500px]"
            >
            MoonDAO is accelerating our multiplanetary future with a global network and open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement.
          </p>
          <MailingList/>
        </div>
      </div>
    </section>
  )
}