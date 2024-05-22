import Link from 'next/link'

export default function Callout2() {
  return ( 
    <section>
        <div className="CALLOUT2-CONTAINER z-10 md:rounded-tl-[5vmax] relative flex flex-col items-end justify-end gradient-4 pt-0 lg:pt-5 p-5 pb-[10vmax] md:pr-10 md:pl-10 min-h-[250px] lg:min-h-[600px]">
        <div className="BACKGROUND-ELEMENTS"> 
            <div className="gradient-3 w-full h-[50%] absolute bottom-0 left-0"></div>
            <div className="BOTTOM-DIVIDER hidden divider-4 absolute left-0 bottom-[-2px] w-[60%] h-full"></div>
            <div className="FEATURED-IMAGE feature-3 absolute top-0 right-0 w-[80vmin] md:w-[70%] lg:w-[45vmax] mt-[-5vmax] h-full mt-5"></div>
        </div>
        <div className="CONTENT relative pt-[220px] md:pt-20  md:pb-0 w-full pr-5 lg:w-[70%]]">
            <h1 className="header font-GoodTimes">
              Space is for<br></br>EVERYONE 
            </h1>
            <p className="PARAGRAPH pt-2 pb-5 text-lg w-[100%] md:w-[100%] lg:max-w-[500px]">Space should belong to the people, not the select few. We envision a future where space is by the people for the people, irrespective of borders. Our mission is to accelerate the development of a self-sustaining, self-governing settlement on the Moon. Want to help govern and create that future?</p>
            <Link href="https://app.moondao.com/join">
              <button className="BUTTON rounded-br-[10px] px-4 py-2 bg-dark-cool md:bg-blue-500 lg:bg-dark-cool text-white font-GoodTimes hover:pl-5 duration-500 focus:outline-none " type="submit">Become A Member</button>
            </Link>
        </div>
        </div>
    </section>
  )
}
