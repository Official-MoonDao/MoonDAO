export default function Hero() {
  return ( 
    <section className="overflow-visible relative w-full">
      <div className="HERO-CONTAINER bg-white flex flex-col gradient-1 h-[80vh] items-end justify-end lg:items-start lg:justify-center md:h-[90vmin] md:items-start md:justify-end md:pl-10 md:pr-10 min-h-[675px] mt-[-1px] overflow-hidden p-5 pb-[10vmax] lg:pb-40 relative rounded-bl-[2vmax] z-10">
        <div className="TOP-LEFT-DIVIDER divider-1 absolute h-full left-0 top-0 w-[45%]"></div>
        <div className="FEATURED-IMAGE-CONTAINER absolute h-[100%] left-0 overflow-hidden top-0 w-[100%] lg:max-w-[1400px]">
          <div className="FEATURED-IMAGE absolute feature-1 h-full mt-5 right-0 top-0 w-[80vmin] lg:w-[50vmax] md:w-[70%]"></div>
        </div>  
        <div className="gradient-3 absolute bottom-0 h-[50%] left-0 overflow-visible w-full"></div>
        <div className="BOTTOM-RIGHT-DIVIDER absolute bg-bottom bottom-[-2px] divider-2 h-full hidden md:block md:right-0 md:w-[80%] right-[-20%] w-[60%] lg:w-[60%]"></div>
        <div className="CONTENT relative w-[100%] pt-0 md:w-[70%] lg:w-[70%]">
        <h1 className="HEADER flex flex-col font-GoodTimes leading-none text-4xl">
          <span style={{fontSize: 'calc(min(4.5vmin, 30px))'}} className="mt-[5vmax]">The Internet's </span>
          <span style={{fontSize: 'calc(max(12vmin, 30px))'}} className="mt-[1vmin]">Space </span>
          <span style={{fontSize: 'calc(max(9vmin, 30px))'}} className="mt-[1vmin]">Program</span>
        </h1>
          <p className="PARAGRAPH mr-5 max-w-[350px] pb-5 pt-2 text-lg w-full md:w-[100%] lg:max-w-[500px]">MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement</p>
          <form className="FORM-CONTAINER flex flex-col items-center max-w-[300px] md:flex-row md:mt-5 pb-10 rounded-md w-full">
            <input className="INPUT-FIELD bg-dark-cool focus:outline-none focus:ring-white-500 px-3 py-2 rounded-tl-[10px] md:rounded-bl-[10px] rounded-bl-0 w-full" type="email" placeholder="Enter your email" />
            <button className="BUTTON bg-white duration-500 focus:outline-none font-GoodTimes hover:pl-5 md:rounded-bl-0 px-4 py-2 rounded-bl-[10px] rounded-br-[10px] text-dark-cool w-full lg:bg-white" type="submit">Subscribe</button>
          </form>
        </div>
      </div>
      <div className="absolute bg-white bottom-[-20px] hidden h-[40px] md:block right-0 w-[50%] z-10"></div>
    </section>
  )
}
