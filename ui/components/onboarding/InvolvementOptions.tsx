'use client'
import { PopupButton } from "react-calendly";
import { useEffect, useState } from "react";
import Image from 'next/image'

export function InvolvementOptions() {
  function Calendly() {
    const [rootElement, setRootElement] = useState<HTMLElement | null>(null);


    useEffect(() => {
      // Wait for the component to be mounted before setting the rootElement
      if (typeof window !== "undefined") {
        setRootElement(document.getElementById("__next"));
      }
    }, []);

    return (
      <div className="cal_div">
        <PopupButton
          className="mt-10 px-[10px] py-[10px] border border-white border-opacity-[0.16] font-bold text-[20px]"
          url="https://calendly.com/moondao-onboarding/30min"
          rootElement={rootElement!}
          text="Join Discord"
        />
      </div>
    );
  }

  function Card({ label, description, CTA, logo, children, isOnboardingCall }: any) {
    return (
      <div className="flex flex-col w-[327px] py-8 px-5 border-white border-opacity-20 border font-RobotoMono">
        <Image src={logo} width={40} height={40} alt={`${label} logo`} />
        <div className="mt-7">
          <h1 className="font-bold text-[20px]">{label}</h1>
          <p className="mt-3 opacity-60">{description}</p>
          {!isOnboardingCall ? (<button className="mt-10 px-[10px] py-[10px] border border-white border-opacity-[0.16] font-bold text-[20px]">
            {CTA}
          </button>) : (<Calendly />)}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 flex flex-col lg:flex-row gap-7 xl:gap-8 2xl:gap-10">
      <Card
        label={'Stay Informed'}
        description={
          'Get email updates on MoonDAO milestones, sweepstakes alerts and upcoming events.'
        }
        logo="/onboardingbell.png"
        CTA="Get email updates"
      ></Card>
      <Card
        label={'Join Community'}
        logo="/onboardingphone.png"
        description={
          'Join our community and say hello! Join our welcome calls where you can learn what we are about and how you can get involved!'
        }
        CTA="Join Discord"
        isOnboardingCall={true}
      ></Card>
    </div>
  )
}
