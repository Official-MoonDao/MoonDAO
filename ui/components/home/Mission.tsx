import Image from 'next/image'
import Link from 'next/link'
import { useRef, useEffect, useState, Suspense } from 'react'
import useMouse from '../../lib/home/useMouse'
import useOnScreen from '../../lib/utils/hooks/useOnScreen'
import SlideButton from './SlideButton'

export default function Mission(props: any) {
  const { mouseX, blur } = useMouse()
  const contentRef: any = useRef()
  const contentRefValue = useOnScreen(contentRef)
  const [isContentRef, setIsContentRef] = useState(false)
  const layer1Ref: any = useRef()
  const layer2Ref: any = useRef()
  const satRef: any = useRef()

  // useEffect(() => {
  //   if (layer1Ref.current) {
  //     layer1Ref.current.style.transform += `translateX(${-mouseX * 0.5}px)`
  //     layer1Ref.current.style.filter = `blur(${
  //       window?.innerWidth * 0.0015 - blur
  //     }px)`
  //   }
  //   if (layer2Ref.current) {
  //     layer2Ref.current.style.transform += `translateX(${mouseX}px)`
  //   }
  //   if (satRef.current) {
  //     satRef.current.style.transform = `translateX(${blur * 10}px)`
  //     satRef.current.style.filter = `blur(${blur}px)`
  //   }
  // }, [mouseX, blur])

  useEffect(() => {
    if (!isContentRef) {
      setIsContentRef(contentRefValue)
    }
  }, [contentRefValue])
  return (
    <div className="flex flex-col min-h-[700px] md:min-h-[1000px]">
      {/* <Image
        className="bg-mission"
        src={'/home/brush-stroke-bottom-right.svg'}
        alt=""
        width={1000}
        height={1000}
        priority
      /> */}
      <div className="z-40" ref={contentRef}>
        {isContentRef && (
          <div className="">
            <div className="flex gap-4">
              <Image src="/home/white-star.svg" width={50} height={50} alt="" />

              <p className="font-bold">{`We are an open source community where everything is governed and created by our members.`}</p>
            </div>

            <p className="mt-4">
              MoonDAO is where space dreamers and serious builders unite. We set
              ambitious, achievable goals and then work together to make them
              happen.
            </p>
            <Link
              href="https://moondao.com/docs/constitution"
              target="_blank"
              rel="no refferer"
              passHref
            >
              <SlideButton className="mt-4">READ THE CONSTITUTION</SlideButton>
            </Link>
          </div>
        )}
      </div>
      <Suspense fallback={null}>
        <div className="h-full max-w-[1000px]">
          <div className="relative" ref={layer1Ref}>
            <Image
              className="w-full absolute z-0"
              src="/home/card3.svg"
              alt=""
              width={580}
              height={300}
            />
          </div>
          <div className={'relative z-20 h-[500px]'} ref={layer2Ref}>
            <Image
              className="w-full absolute blur-[1px]"
              src="/home/outline-card3.svg"
              alt=""
              width={550}
              height={500}
            />
            <div className="relative z-30" ref={satRef}>
              <Image
                className="w-full absolute"
                src="/home/sat.svg"
                alt=""
                width={580}
                height={200}
              />
            </div>
            <h1 className="font-GoodTimes text-4xl z-40 absolute bottom-32 md:bottom-[-20%]">
              MOONDAO IS <br />
              <span className="bg-white text-black px-2 rounded-sm">
                COMMUNITY BUILT
              </span>
            </h1>
          </div>
        </div>
      </Suspense>
    </div>
  )
}
