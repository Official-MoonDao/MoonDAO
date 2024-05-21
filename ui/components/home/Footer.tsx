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
  <div className="BOTTOM-BAR w-full flex items-center justify-center p-5 pb-10">
    <a href="https://docs.moondao.com/Legal/Website-Privacy-Policy">Privacy policy </a>
    <span>&nbsp;|&nbsp;</span>
    <a href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions">Terms of Service</a>
  </div>
  )
}
