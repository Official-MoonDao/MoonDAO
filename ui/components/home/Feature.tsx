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
    <div className="IMAGE-SECTION rounded-bl-[5vmax] bg-mid-cool w-full p-5 pt-0 pb-0 md:p-10 md:pt-0 lg:pr-[20%]">
        <div className="IMAGE-CONTAINER rounded-lg gradient-2 relative md:mt-[-25vh] z-10 max-w-[1200px]">
            <img className="DUDE-PERFECT-IMAGE mb-[-25vh] rounded-lg m-2" src="/assets/dude-perfect.jpg" />
        </div>
    </div>
)
}