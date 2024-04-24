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
  useEffect(() => {
    // if (cardRef?.current) {
    //   cardRef.current.style.transform += `translateX(${mouseX}px)`
    //   splatterRef.current.style.transform += `translateX(${mouseX}px)`
    // }
    // if (layer2Ref?.current) {
    //   layer2Ref.current.style.transform += `translateX(${-mouseX}px)`
    //   layer2Ref.current.style.filter = `blur(${blur}px)`
    // }
    // if (astroRef?.current) {
    //   astroRef.current.style.transform = `rotate(${blur * 2}deg) translateY(${
    //     blur * 2
    //   }px)`
    // }
  }, [blur, mouseX])
  return (
    <div className="min-h-[650px] md:min-h-[1000px]">
      {/* <Image
          className="bg-hero"
          src={'/home/brush-stroke-bottom-right2.svg'}
          alt=""
          width={1000}
          height={1000}
        /> */}
      <div className="flex flex-col animate-fadeInLeft z-10">
        <h1 className="text-4xl font-GoodTimes">
          {'THE '}
          <span className="bg-white text-black px-2 rounded-sm">
            {"INTERNET'S"}
          </span>
          <br />
          {'SPACE PROGRAM'}
        </h1>

        <p className="mt-4 w-full">
          {
            'MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement.'
          }
        </p>
        <Link
          href="https://discord.com/invite/moondao"
          target="_blank"
          rel="no refferer"
          passHref
        >
          <SlideButton className="mt-4" onClick={() => setModal(true)}>
            Join Our Community
          </SlideButton>
        </Link>
      </div>
      <Suspense fallback={null}>
        <div className="relative max-w-[1000px] flex justify-center items-center h-full">
          <div>
            <Image
              ref={cardRef}
              className="absolute top-0 left-0 z-0 w-full"
              src="/home/card.svg"
              alt=""
              width={630}
              height={500}
            />
            <Image
              ref={splatterRef}
              className="absolute top-0 left-0 w-full"
              src="/home/splatter-orange-purple.svg"
              alt=""
              width={600}
              height={600}
              priority
            />
          </div>
          <div className={'z-30'}>
            <Image
              ref={outlineCardRef}
              className="absolute top-0 left-0 w-full blur-[0.8px]"
              src="/home/outline-card.svg"
              alt=""
              width={520}
              height={500}
            />
            <div className="z-30">
              <Image
                ref={astroRef}
                className="absolute top-0 left-0 w-full rotate-0"
                src="/home/astronaut2.svg"
                alt=""
                width={600}
                height={600}
              />
            </div>
          </div>
        </div>
      </Suspense>
    </div>
  )
}
