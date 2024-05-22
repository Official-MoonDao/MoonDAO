import { Suspense, useEffect, useRef, useState } from 'react'
import useMouse from '../../lib/home/useMouse'
import Footer from '../home/Footer'; 

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
    <section>  
        <div className="CONTAINER relative pb-20 pr-20 min-h-[675px] md:min-h-[650px]">
            <div className="BACKGROUND">  
                <div className="BACKGROUND-GRADIENT gradient-1 w-full rounded-bl-[15vmax] overflow-hidden h-full absolute bottom-0 left-0"></div>
                <div className="hidden TOP-LEFT-DIVIDER divider-6 mt-[-1px] absolute top-0 left-0 w-[50vmax] h-full"></div>
                <div className="BOTTOM-RIGHT-DIVIDER divider-7 bg-bottom absolute bottom-[-2px] right-[-20%] md:right-0 w-[60%] md:w-[60%] lg:w-[60%] h-full "></div>
            </div>
            <div className="CONTENT-SECTION flex flex-col md:flex-row max-w-[1200px] justify-start w-full">
                <div className="CONTENT-CONTAINER z-10 flex justify-end">   
                    <div className="TOP-LEFT-DIVIDER divider-6 min-w-[500px] w-[100%] mt-[-1px] h-full"></div>
                    <div className="flex flex-col ml-[-10vw]">
                        <h1 className="HEADER text-4xl font-GoodTimes leading-none flex flex-col">
                            <span style={{fontSize: 'calc(max(7vmin, 30px))'}} className="mt-[5vmax]">Join Our </span>
                            <span style={{fontSize: 'calc(max(10vmin, 30px))'}} className="mt-[1vmin]">MISSION </span>
                        </h1>
                        <p className="PARAGRAPH w-full pt-2 pb-5 mr-5 md:w-[100%] ">MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement.</p>
                        <form className="FORM-CONTAINER w-full max-w-[300px] md:mt-5 flex flex-col md:flex-row items-center rounded-md pb-10">
                            <input className="INPUT-FIELD w-full bg-dark-cool rounded-tl-[10px] rounded-bl-0 md:rounded-bl-[10px] px-3 py-2  focus:outline-none focus:ring-white-500" type="email" placeholder="Enter your email" />
                            <button className="BUTTON rounded-bl-[10px] md:rounded-bl-0 rounded-br-[10px] w-full px-4 py-2 bg-white md:bg-blue-500 lg:bg-white text-dark-cool font-GoodTimes hover:pl-5 duration-500 focus:outline-none " type="submit">Subscribe</button>
                        </form>
                    </div>
                </div> 
            </div>
        </div>
        <div className="BOTTOM-BAR gradient-8">
            <div className="FOOTER-CONTAINER flex justify-end max-w-[1200px]">
                <Footer />
            </div>
        </div>    
    </section>

  )
}
