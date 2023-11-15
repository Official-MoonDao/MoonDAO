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
          className="mt-10 px-[10px] py-[10px] border border-slate-600 dark:border-white dark:border-opacity-[0.16] font-bold text-[20px]"
          url="https://calendly.com/moondao-onboarding/30min"
          rootElement={rootElement!}
          text="Join Discord"
        />
      </div>
    );
  }

  function Card({ label, description, CTA, logo, children, isOnboardingCall }: any) {
    return (
      <div className="flex flex-col w-[327px] py-8 px-5 border-slate-700 dark:border-white dark:border-opacity-20 border font-RobotoMono text-slate-950 dark:text-gray-50">
        <Logo logo={logo}/>

        <div className="mt-7">
          <h1 className="font-bold text-[20px]">{label}</h1>
          <p className="mt-3 opacity-60">{description}</p>
          {!isOnboardingCall ? (<button className="mt-10 px-[10px] py-[10px] border border-slate-600 dark:border-white dark:border-opacity-[0.16] font-bold text-[20px]">
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
        logo="alert"
        CTA="Get email updates"
      ></Card>
      <Card
        label={'Join Community'}
        logo="phone"
        description={
          'Join our community and say hello! Join our welcome calls where you can learn what we are about and how you can get involved!'
        }
        CTA="Join Discord"
        isOnboardingCall={true}
      ></Card>
    </div>
  )
}

{/*Component to decide which logo to show and to toggle their colors according to color mode*/}
const Logo = ({logo}:any) =>{

  return(
    <>
{logo === 'alert'?( 
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
<path d="M20 33C20.8333 33 21.542 32.708 22.126 32.124C22.71 31.54 23.0013 30.832 23 30H17C17 30.8333 17.292 31.542 17.876 32.126C18.46 32.71 19.168 33.0013 20 33ZM10 28H30V24H28V18.8C28 16.7667 27.4747 14.908 26.424 13.224C25.3733 11.54 23.8987 10.4653 22 10V9C22 8.43333 21.808 7.958 21.424 7.574C21.04 7.19 20.5653 6.99867 20 7C19.4333 7 18.958 7.192 18.574 7.576C18.19 7.96 17.9987 8.43467 18 9V10C16.1 10.4667 14.6253 11.542 13.576 13.226C12.5267 14.91 12.0013 16.768 12 18.8V24H10V28ZM20 40C17.2333 40 14.6333 39.4747 12.2 38.424C9.76667 37.3733 7.65 35.9487 5.85 34.15C4.05 32.35 2.62533 30.2333 1.576 27.8C0.526667 25.3667 0.00133333 22.7667 0 20C0 17.2333 0.525333 14.6333 1.576 12.2C2.62667 9.76667 4.05133 7.65 5.85 5.85C7.65 4.05 9.76667 2.62533 12.2 1.576C14.6333 0.526667 17.2333 0.00133333 20 0C22.7667 0 25.3667 0.525333 27.8 1.576C30.2333 2.62667 32.35 4.05133 34.15 5.85C35.95 7.65 37.3753 9.76667 38.426 12.2C39.4767 14.6333 40.0013 17.2333 40 20C40 22.7667 39.4747 25.3667 38.424 27.8C37.3733 30.2333 35.9487 32.35 34.15 34.15C32.35 35.95 30.2333 37.3753 27.8 38.426C25.3667 39.4767 22.7667 40.0013 20 40Z" className="fill-black dark:fill-white"/>
</svg>) : logo === 'phone' ? (<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
<path d="M3.77634 1.16215C5.9086 -0.0313173 8.62761 -0.310958 11.2268 0.348195C12.4926 0.667785 13.5738 1.48923 14.2229 2.62028L16.465 6.53025C17.2642 7.9242 17.495 9.57262 17.1094 11.1324C16.7239 12.6923 15.7517 14.0434 14.3952 14.9045L12.4227 16.1579C11.6063 16.6747 11.3067 17.4662 11.4939 18.0929C12.1631 20.335 13.6437 22.8218 15.2716 24.5246C15.7559 25.034 16.6448 25.1538 17.5137 24.647L18.6048 24.0103C19.3207 23.593 20.1126 23.3224 20.9342 23.2144C21.7558 23.1063 22.5907 23.1629 23.3902 23.3809C24.1897 23.5989 24.9377 23.974 25.5908 24.4841C26.2438 24.9943 26.7887 25.6293 27.1938 26.3523L29.2037 29.9352C29.8603 31.1087 29.9677 32.5094 29.5033 33.7703C28.577 36.2745 26.7918 38.2944 24.5971 39.3056C22.3675 40.3318 19.7583 40.2894 17.3963 38.7139C13.6561 36.2221 9.14944 32.0275 5.06718 25.0315C0.932491 17.9406 -0.108671 11.9058 0.00867834 7.40663C0.0835821 4.52783 1.60663 2.37559 3.77634 1.16215ZM32.3621 1.30447C32.3621 0.973372 32.2306 0.655837 31.9965 0.421717C31.7624 0.187598 31.4448 0.0560705 31.1137 0.0560705C30.7826 0.0560705 30.4651 0.187598 30.231 0.421717C29.9968 0.655837 29.8653 0.973372 29.8653 1.30447V7.54894H23.6233C23.2922 7.54894 22.9747 7.68047 22.7406 7.91459C22.5065 8.14871 22.3749 8.46625 22.3749 8.79734C22.3749 9.12844 22.5065 9.44597 22.7406 9.68009C22.9747 9.91421 23.2922 10.0457 23.6233 10.0457H29.8653V16.2877C29.8653 16.6188 29.9968 16.9363 30.231 17.1705C30.4651 17.4046 30.7826 17.5361 31.1137 17.5361C31.4448 17.5361 31.7624 17.4046 31.9965 17.1705C32.2306 16.9363 32.3621 16.6188 32.3621 16.2877V10.0457H38.6041C38.9352 10.0457 39.2527 9.91421 39.4868 9.68009C39.721 9.44597 39.8525 9.12844 39.8525 8.79734C39.8525 8.46625 39.721 8.14871 39.4868 7.91459C39.2527 7.68047 38.9352 7.54894 38.6041 7.54894H32.3621V1.30447Z" className="fill-black dark:fill-white"/>
</svg>) : (<>No Logo</>)}
    </>
  )

}

