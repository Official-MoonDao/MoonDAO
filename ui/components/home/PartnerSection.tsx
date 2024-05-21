import { Suspense, useEffect, useRef, useState } from 'react'
import useMouse from '../../lib/home/useMouse'
import Partner from '../home/Partner'; 

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
  <div className="flex justify-start bg-white rounded-tl-[5vmax] ">
    <div className=" w-full pt-20 pb-5 flex items-center flex-col max-w-[1200px]">
      <h2 className="header font-GoodTimes text-dark-cool">Our Partners</h2>
      <div className=" w-full max-w-[1200px] m-5 mb-0">  
        <div className="p-5 pt-0 flex flex-rowflex flex-row flex-wrap justify-center">
        <Partner alt="Blue Origin Logo" logo="assets\logo-blue-origin.svg" />
        <Partner alt="Lifeship Logo" logo="assets\logo-lifeship.svg" />
        <Partner alt="Space For A Better World Logo" logo="assets\logo-space-for-a-better-world.png" />
        <Partner alt="CryoDAO Logo" logo="assets\logo-cryodao.svg" />
        <Partner alt="Desci Labs Logo" logo="assets\logo-desci-labs.svg" />
        <Partner alt="Desci World Logo" logo="assets\logo-intuitive-machines.svg" />
        </div>
      </div> 
    </div>
  </div> 
  )
}
