import { Suspense, useEffect, useRef, useState } from 'react'
import useMouse from '../../lib/home/useMouse'

export default function Hero(props: any) {
  const { mouseX, blur } = useMouse()
  const [modal, setModal] = useState(false)
  const layer1Ref: any = useRef()
  const layer2Ref: any = useRef()

  const cardRef: any = useRef()
  const splatterRef: any = useRef()
  const outlineCardRef: any = useRef()
  const astroRef: any = useRef()
  return ( 
  <section className="overflow-visible relative w-full]">
    <div className="HERO-CONTAINER rounded-bl-[2vmax] overflow-hidden relative z-10 bg-white flex flex-col items-end justify-end md:items-start lg:items-start md:justify-end lg:justify-center gradient-1 p-5 mt-[-1px] pb-[10vmax] md:pr-10 md:pl-10 lg:pb-40 min-h-[675px] h-[80vh] md:h-[90vmin]">
      <div className="TOP-LEFT-DIVIDER divider-1 absolute top-0 left-0 w-[45%] h-full"></div>
      <div className="FEATURED-IMAGE-CONTAINER absolute w-[100%] h-[100%] top-0 left-0 overflow-hidden lg:max-w-[1400px]">
        <div className="FEATURED-IMAGE feature-1 absolute top-0 right-0 w-[80vmin] md:w-[70%] lg:w-[50vmax] h-full mt-5"></div>
      </div>  
      <div className="gradient-3 w-full h-[50%] absolute bottom-0 left-0 overflow-visible"></div>
      <div className="BOTTOM-RIGHT-DIVIDER divider-2 hidden md:block bg-bottom absolute bottom-[-2px] right-[-20%] md:right-0 w-[60%] md:w-[80%] lg:w-[60%] h-full "></div>
      <div className="CONTENT relative pt-0 w-[100%] md:w-[70%] lg:w-[70%]">
      <h1 className="HEADER text-4xl font-GoodTimes leading-none flex flex-col">
        <span style={{fontSize: 'calc(min(4.5vmin, 30px))'}} className="mt-[5vmax]">The Internet's </span>
        <span style={{fontSize: 'calc(max(12vmin, 30px))'}} className="mt-[1vmin]">Space </span>
        <span style={{fontSize: 'calc(max(9vmin, 30px))'}} className="mt-[1vmin]">Program</span>
      </h1>
        <p className="PARAGRAPH w-full max-w-[350px] pt-2 pb-5 mr-5 text-lg w-[130%] md:w-[100%] lg:max-w-[500px]">MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement</p>
        <form className="FORM-CONTAINER w-full max-w-[300px] md:mt-5 flex flex-col md:flex-row items-center rounded-md pb-10">
          <input className="INPUT-FIELD w-full bg-dark-cool rounded-tl-[10px] rounded-bl-0 md:rounded-bl-[10px] px-3 py-2  focus:outline-none focus:ring-white-500" type="email" placeholder="Enter your email" />
          <button className="BUTTON rounded-bl-[10px] md:rounded-bl-0 rounded-br-[10px] w-full px-4 py-2 bg-white md:bg-blue-500 lg:bg-white text-dark-cool font-GoodTimes hover:pl-5 duration-500 focus:outline-none " type="submit">Subscribe</button>
        </form>
      </div>
    </div>
    {/* This div exists to visually blend the border between sections*/}
    <div className="z-10 hidden md:block absolute bottom-[-20px] right-0 bg-white w-[50%] h-[40px]"></div>
  </section>
    
  )
}
