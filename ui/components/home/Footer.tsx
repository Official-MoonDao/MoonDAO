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
  <div className="">  
    <div className="relative flex flex-col items-start justify-end p-5 pb-20 md:pr-10 md:pl-10 lg:pb-40 min-h-[675px] h-[80vh] md:h-[90vmin]">
      <div className="BACKGROUND">  
        <div className="gradient-1 w-full h-full absolute bottom-0 left-0 overflow-visible"></div>
        <div className="TOP-LEFT-DIVIDER divider-6 absolute top-0 left-0 w-[40vmax] h-full"></div>
        <div className="BOTTOM-RIGHT-DIVIDER divider-7 bg-bottom absolute bottom-[-2px] right-[-20%] md:right-0 w-[60%] md:w-[80%] lg:w-[60%] h-full "></div>
      </div>
      <div className="CONTENT-SECTION flex max-w-[1200px] ml-[-15vmax] p-5 overflow-hidden justify-end w-full">
        <div className="WRITTEN-CONTENT-CONTAINER z-10">   
          <h1 className="HEADER text-4xl font-GoodTimes leading-none flex flex-col">
            <span style={{fontSize: 'calc(min(12vmin, 30px))'}} className="mt-[5vmax]">Join Our </span>
            <span style={{fontSize: 'calc(max(12vmin, 30px))'}} className="mt-[1vmin]">MISSION </span>
          </h1>
          <p className="PARAGRAPH w-full max-w-[350px] pt-2 pb-5 mr-5 text-lg w-[130%] md:w-[100%] lg:max-w-[500px]">MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement.</p>
          <form className="FORM-CONTAINER w-full max-w-[300px] md:mt-5 flex flex-col md:flex-row items-center rounded-md pb-10">
            <input className="INPUT-FIELD w-full bg-dark-cool rounded-tl-[10px] rounded-bl-0 md:rounded-bl-[10px] px-3 py-2  focus:outline-none focus:ring-white-500" type="email" placeholder="Enter your email" />
            <button className="BUTTON rounded-bl-[10px] md:rounded-bl-0 rounded-br-[10px] w-full px-4 py-2 bg-white md:bg-blue-500 lg:bg-white text-dark-cool font-GoodTimes hover:pl-5 duration-500 focus:outline-none " type="submit">Subscribe</button>
          </form>
        </div> 
      </div>
    </div>
    <div className="BOTTOM-BAR w-full flex index-center justify-center bg-dark-cool p-5 pb-10">
      <a href="#">Privacy policy </a>
      <span>&nbsp;|&nbsp;</span>
      <a href="#">Terms of Service</a>
    </div>
  </div>

  )
}
