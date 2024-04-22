import Image from 'next/image'
import Link from 'next/link'
import { useRef, useEffect, useState, Suspense } from 'react'
import useMouse from '../../lib/home/useMouse'
import useOnScreen from '../../lib/utils/hooks/useOnScreen'
import SlideButton from './SlideButton'

export default function Constitution(props: any) {
  const { mouseX, blur } = useMouse()
  const contentRef: any = useRef()
  const contentRefValue = useOnScreen(contentRef)
  const [isContentRef, setIsContentRef] = useState(false)
  const layer1Ref: any = useRef()
  const layer2Ref: any = useRef()
  const astroRef: any = useRef()

  // useEffect(() => {
  //   if (layer1Ref.current) {
  //     layer1Ref.current.style.transform += `translateY(${-mouseX * 0.5}px)`
  //     layer1Ref.current.style.filter = `blur(${
  //       window?.innerWidth * 0.0015 - blur
  //     }px)`
  //   }
  //   if (layer2Ref.current) {
  //     layer2Ref.current.style.transform += `translateY(${mouseX}px)`
  //   }
  //   if (astroRef.current) {
  //     astroRef.current.style.transform += `translateY(${mouseX}px)`
  //     astroRef.current.style.filter = `blur(${blur}px)`
  //   }
  // }, [mouseX, blur])

  useEffect(() => {
    if (!isContentRef) {
      setIsContentRef(contentRefValue)
    }
  }, [contentRefValue])
  return (
    <div className="min-h-[900px] md:min-h-[1200px]">
      {/* <Image
        className="absolute bg-constitution"
        src={'/home/brush-stroke-bottom-left.svg'}
        alt=""
        width={1000}
        height={1000}
      /> */}
      <div className="z-40" ref={contentRef}>
        {isContentRef && (
          <div className="relative animate-fadeInLeft">
            <p className="font-bold">
              Space will be the largest economic opportunity of our lifetime.
            </p>
            <p className="mt-4">
              We envision a future where space is by the people for the people.
              Our mission is to accelerate the development of a self-sustaining,
              self-governing settlement on the Moon. Want to help create the
              future?
            </p>
            <Link href="/join" passHref>
              <SlideButton className="mt-4">BECOME A MEMBER</SlideButton>
            </Link>
          </div>
        )}
      </div>
      <Suspense fallback={null}>
        <div className="relative flex flex-col">
          <div className="relative h-full max-w-[1000px]">
            <h1 className="text-4xl font-GoodTimes relative right-[-30%] top-48 z-40">
              SPACE IS FOR <br />
              <span className="bg-white text-black px-2 rounded-sm">
                EVERYONE
              </span>
            </h1>
            <div className="w-full absolute" ref={layer1Ref}>
              <Image
                className="w-full max-w-[800px] z-0"
                src="/home/card4.svg"
                alt=""
                width={700}
                height={800}
              />
            </div>
            <div className={'z-20'} ref={layer2Ref}>
              <Image
                className="w-full max-w-[800px] absolute blur-[1px]"
                src="/home/outline-card4.svg"
                alt=""
                width={450}
                height={400}
              />
            </div>
            <div className={'w-full z-30'} ref={layer2Ref}>
              <Image
                className="w-full max-w-[800px] absolute"
                src="/home/splatter-white.svg"
                alt=""
                width={550}
                height={300}
              />
            </div>
            <div className="w-full absolute right-[40px]" ref={astroRef}>
              <Image
                className="w-full max-w-[800px]"
                src="/home/astronaut.svg"
                alt=""
                width={500}
                height={300}
              />
            </div>
          </div>
        </div>
      </Suspense>
    </div>
  )
}
