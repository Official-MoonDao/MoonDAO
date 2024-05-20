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
    <div className="VIDEO-SECTION-CONTAINER relative">
        <div className="absolute w-full h-full gradient-6"></div>
        <div className="VIDEO-SECTION max-w-[1200px] z-10 p-5 pb-0 md:p-10 md:pb-0 pt-0 mt-[-10vh] w-full lg:mt-[-20vh]">
            <div className="VIDEO-CONTAINER rounded-lg gradient-2 relative pt-[56.25%] z-10">
                <iframe className="VIDEO rounded-lg absolute top-0 left-0 m-2" width="100%" height="100%" title="Welcome To MoonDAO" src="https://player.vimeo.com/video/944146258?h=a765180cf1" frameBorder="0" allowFullScreen></iframe>
            </div>
        </div>
    </div>
)
}