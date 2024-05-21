
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
    <div className="IMAGE-SECTION rounded-bl-[5vmax] bg-dark-cool w-full p-5 pt-0 pb-10 md:p-10 md:pt-0 lg:pr-[20%]">
        <div className="IMAGE-CONTAINER gradient-2 rounded-[5vmax] rounded-tr-[20px] pl-[1vmax] relative md:mt-[-5vh] lg:mt-[-25vh] z-10 max-w-[1200px]">
            <img className="DUDE-PERFECT-IMAGE mb-[-25vh] rounded-[5vmax] rounded-tr-[20px]" src="/assets/dude-perfect.jpg" />
        </div>
    </div>
)
}