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
  <div className="bg-white w-full pt-10 pb-5 rounded-tl-[5vmax] flex items-center flex-col">
    <h2 className="header font-GoodTimes text-dark-cool">Our Partners</h2>
    <div className=" w-full max-w-[1200px] m-5 mb-0">  
      <div className="p-5 pt-0 flex flex-rowflex flex-row flex-wrap justify-center">
      <Partner logo="assets\logo-blue-origin.svg" alt="Blue Origin" />
      <Partner logo="assets\logo-lifeship.svg" alt="Lifeship" />
      <Partner logo="assets\logo-space-for-a-better-world.png" alt="Space For A Better World" />
      <Partner logo="assets\logo-cryodao.svg" alt="CryoDAO" />
      <Partner logo="assets\logo-desci-labs.svg" alt="Desci Labs" />
      <Partner logo="assets\logo-intuitive-machines.svg" alt="Intuitive Machines" />
      </div>
    </div> 
  </div> 
  )
}
