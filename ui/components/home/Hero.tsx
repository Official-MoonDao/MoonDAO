import MailingList from '../layout/MailingList'; 

export default function Hero() {
  return ( 
    <section id="hero-section" className="overflow-visible relative w-full">
      <div id="hero-container" className="flex flex-col gradient-1 h-[80vh] items-end justify-end lg:items-start lg:justify-center md:h-[90vmin] md:items-start md:justify-end md:pl-10 md:pr-10 min-h-[675px] mt-[-1px] overflow-hidden p-5 pb-[10vmax] lg:pb-40 relative rounded-bl-[2vmax] z-10">
        <div id="tl-divider" className="divider-1 absolute h-full left-0 top-0 w-[45%]"></div>
        <div id="featured-image-container" className="absolute h-[100%] left-0 overflow-hidden top-0 w-[100%] lg:max-w-[1400px]">
          <div id="featured-image" className="absolute feature-1 h-full mt-5 right-0 top-0 w-[80vmin] lg:w-[50vmax] md:w-[70%]"></div>
        </div>  
        <div id="background-gradient" className="gradient-3 absolute bottom-0 h-[50%] left-0 overflow-visible w-full"></div>
        <div id="bottom-right-container" className="BOTTOM-RIGHT-DIVIDER absolute bg-bottom bottom-[-2px] divider-2 h-full hidden md:block md:right-0 md:w-[80%] right-[-20%] w-[60%] lg:w-[60%]"></div>
        <div id="content" className="relative w-[100%] pt-0 md:w-[70%] lg:w-[70%]">
        <h1 id="header" className="flex flex-col font-GoodTimes leading-none text-4xl">
          <span style={{fontSize: 'calc(min(4.5vmin, 30px))'}} className="mt-[5vmax]">The Internet's </span>
          <span style={{fontSize: 'calc(max(12vmin, 30px))'}} className="mt-[1vmin]">Space </span>
          <span style={{fontSize: 'calc(max(9vmin, 30px))'}} className="mt-[1vmin]">Program</span>
        </h1>
          <p id="paragraph-content" className="mr-5 max-w-[350px] pb-5 pt-2 text-lg w-full md:w-[100%] md:max-w-[350px] lg:max-w-[500px]">MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement.</p>
          <MailingList />
        </div>
      </div>
      <div id="section-divider" className="absolute bg-white bottom-[-20px] hidden h-[40px] md:block right-0 w-[50%] z-10"></div>
    </section>
  )
}
