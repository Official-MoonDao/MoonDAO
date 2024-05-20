import Image from 'next/image'
import Link from 'next/link'
import { useRef, useEffect, useState, Suspense } from 'react'
import useMouse from '../../lib/home/useMouse'
import useOnScreen from '../../lib/utils/hooks/useOnScreen'

export default function Mission(props: any) {
  const { mouseX, blur } = useMouse()
  const contentRef: any = useRef()
  const contentRefValue = useOnScreen(contentRef)
  const [isContentRef, setIsContentRef] = useState(false)
  const layer1Ref: any = useRef()
  const layer2Ref: any = useRef()
  const satRef: any = useRef()

  useEffect(() => {
    if (!isContentRef) {
      setIsContentRef(contentRefValue)
    }
  }, [contentRefValue])
  return (
    <div className="bg-dark-warm md:bg-transparent"> 
      <div className="CALLOUT1-CONTAINER md:rounded-tl-[2vmax] rounded-bl-[5vmax] z-0 relative w-[100%] h-[100%] bg-white mt-[-2vmax] pt-[2vmax] pb-0 lg:pb-10">
        <div className="BOTTOM-RIGHT-DIVIDER divider-3 absolute bottom-[-2px] right-0 w-[250px] md:w-[450px] h-full overflow-visible"></div>
        <div className="CONTENT-CONTAINER overflow-visiblerelative flex flex-col-reverse justify-end lg:flex-row items-start lg:items-center min-h-[250px] md:min-h-[400px] p-5 pt-10 pb-10 md:pb-0 md:p-10 md:pt-10 lg:max-w-[1200px]">
          <div className="FEATURED-IMAGE hidden lg:block feature-2 lg:min-h-[450px] mt-5 md:mr-10 w-[100%] h-[250px] md:h-[70vmax] lg:h-[70vh]"></div>
          <div className="CONTENT overflow-visible relative pb-10 md:pb-0 w-[100%]">
            <h1 className="header flex overflow-visible flex-col text-4xl font-GoodTimes font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-blue-500 leading-none">
                  MoonDAO is <br></br>Community-Built 
            </h1>
            <p className="PARAGRAPH pt-2 pb-5 text-black text-lg w-[100%] max-w-[500px]">MoonDAO is where space dreamers and serious builders unite. We set ambitious, achievable goals and then work together to make them happen</p>
            <button className="BUTTON rounded-br-[10px] px-4 py-2 bg-dark-cool md:bg-blue-500 lg:bg-dark-cool text-white font-GoodTimes hover:pl-5 duration-500 focus:outline-none " type="submit">Read The Consitution</button>
          </div>  
        </div>
      </div>
    </div>  
  )
}
