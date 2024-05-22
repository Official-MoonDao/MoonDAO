import Link from 'next/link'

export default function Callout1() {
  return (
    <section className="bg-dark-warm md:bg-transparent"> 
      <div className="CALLOUT1-CONTAINER md:rounded-tl-[2vmax] rounded-bl-[5vmax] z-0 relative w-[100%] h-[100%] bg-white mt-[-2vmax] pt-[2vmax] pb-0 lg:pb-10">
        <div className="BOTTOM-RIGHT-DIVIDER divider-3 absolute bottom-[-2px] right-0 w-[250px] md:w-[350px] h-full overflow-visible"></div>
        <div className="CONTENT-CONTAINER flex flex-col-reverse justify-end lg:flex-row items-start lg:items-center min-h-[250px] md:min-h-[400px] p-5 pt-10 pb-10 md:pb-0 md:p-10 md:pt-10 lg:max-w-[1200px]">
          <div className="FEATURED-IMAGE hidden lg:block feature-2 lg:min-h-[450px] mt-5 md:mr-10 w-[100%] h-[250px] md:h-[70vmax] lg:h-[70vh]"></div>
          <div className="CONTENT overflow-visible relative pb-20 md:pb-10 w-[100%]">
            <h1 className="header flex overflow-visible flex-col text-4xl font-GoodTimes font-bold bg-clip-text text-dark-cool bg-gradient-to-r from-red-500 to-blue-500 leading-none">
                  MoonDAO is <br></br>Community-Built 
            </h1>
            <p className="PARAGRAPH pt-2 pb-5 text-black text-lg w-[100%] max-w-[500px]">We are an open source space community where everything is proposed, governed, and created by our members. MoonDAO is where space dreamers and serious builders unite. We set ambitious, achievable goals and then work together to make them happen.</p>
            <Link href="https://moondao.com/discord">
              <button className="BUTTON rounded-br-[10px] px-4 py-2 bg-dark-cool lg:bg-dark-cool text-white font-GoodTimes hover:pl-5 duration-500 focus:outline-none " type="submit">Join The Conversation</button>
            </Link>
          </div>  
        </div>
      </div>
    </section>  
  )
}
