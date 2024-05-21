import gsap from 'gsap'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'
import useMouse from '../../lib/home/useMouse'
import SlideButton from './SlideButton'

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
    <div>
        <div className="CALLOUT2-CONTAINER md:rounded-tl-[5vmax] relative bg-white flex flex-col items-start justify-end md:items-start lg:items-start md:justify-end lg:justify-center gradient-4 p-5 pb-10 md:pr-10 md:pl-10 md:pb-20 lg:pb-40 min-h-[500px] md:h-[60vh] md:h-[90vmin]">
        <div className="BACKGROUND-ELEMENTS"> 
            <div className="gradient-3 w-full h-[50%] absolute bottom-0 left-0"></div>
            <div className="FEATURED-IMAGE feature-3 absolute top-0 right-0 w-[80vmin] md:w-[70%] lg:w-[45vmax] mt-[-5vmax] h-full mt-5"></div>
            <div className="BOTTOM-DIVIDER hidden divider-4 absolute left-0 bottom-[-2px] w-[60%] h-full"></div>
        </div>
        <div className="CONTENT relative pt-0 w-full pr-5 md:w-[70%] lg:w-[70%]]">
            <h1 className="header font-GoodTimes">
              Space is for<br></br>EVERYONE 
            </h1>
            <p className="PARAGRAPH pt-2 pb-5 text-lg w-[100%] md:w-[100%] lg:max-w-[500px]">Space should belong to the people, not the select few. We envision a future where space is by the people for the people, irrespective of borders. Our mission is to accelerate the development of a self-sustaining, self-governing settlement on the Moon. Want to help govern and create that future?
</p>
            <button className="BUTTON rounded-br-[10px] px-4 py-2 bg-dark-cool md:bg-blue-500 lg:bg-dark-cool text-white font-GoodTimes hover:pl-5 duration-500 focus:outline-none " type="submit">Read The Consitution</button>
        </div>
        </div>
    </div>
  )
}
