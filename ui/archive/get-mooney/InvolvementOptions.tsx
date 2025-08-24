import {
  BellAlertIcon,
  HandRaisedIcon,
  PhoneArrowUpRightIcon,
  TicketIcon,
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { PopupButton } from 'react-calendly'
import { NewsletterSubModal } from '../../components/newsletter/NewsletterSubModal'

export function InvolvementOptions() {
  const router = useRouter()
  const [enableNewsletterSubModal, setEnableNewsletterSubModal] =
    useState(false)
  function Calendly() {
    const [rootElement, setRootElement] = useState<HTMLElement | null>(null)

    useEffect(() => {
      // Wait for the component to be mounted before setting the rootElement
      if (typeof window !== 'undefined') {
        setRootElement(document.getElementById('__next'))
      }
    }, [])

    return (
      <div className="cal_div">
        <PopupButton
          className="w-full mt-10 px-[10px] py-[10px] border border-slate-600 dark:border-white dark:border-opacity-[0.16] font-bold text-sm"
          url="https://calendly.com/moondaospace/moondao-welcome-call"
          rootElement={rootElement!}
          text="Join Discord"
        />
      </div>
    )
  }

  function Card({
    label,
    description,
    CTA,
    icon,
    onClick,
    children,
    isOnboardingCall,
  }: any) {
    return (
      <div className="flex flex-col w-[250px] py-8 px-5 border-slate-700 dark:border-white dark:border-opacity-20 border font-RobotoMono text-slate-950 dark:text-gray-50">
        {icon}

        <div className="mt-7 pb-12 flex flex-col h-full justify-between">
          <div>
            <h1 className="font-bold text-[20px]">{label}</h1>
            <p className="mt-3 opacity-60 font-[Lato]">{description}</p>
          </div>
          {!isOnboardingCall ? (
            <button
              className="mt-10 px-[10px] py-[10px] border border-slate-600 dark:border-white dark:border-opacity-[0.16] font-bold text-[20px] w-full text-sm"
              onClick={onClick}
            >
              {CTA}
            </button>
          ) : (
            <Calendly />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 flex flex-col xl:flex-row gap-2 xl:gap-3 2xl:gap-8">
      {/* <Card
        label={'Enter the Sweepstakes'}
        description={'Take the leap, for the chance to win a trip to space!'}
        icon={<TicketIcon width={50} />}
        CTA="Enter Sweepstakes"
        onClick={() => {
          router.push('/sweepstakes')
        }}
      /> */}
      <Card
        label={'Stay Informed'}
        description={
          'Get email updates on MoonDAO milestones, sweepstakes alerts and upcoming events.'
        }
        icon={<BellAlertIcon width={50} />}
        CTA="Get email updates"
        onClick={() => {
          setEnableNewsletterSubModal(true)
        }}
      />
      {enableNewsletterSubModal && (
        <NewsletterSubModal setEnabled={setEnableNewsletterSubModal} />
      )}
      <Card
        label={'Join Community'}
        icon={<PhoneArrowUpRightIcon width={50} />}
        description={
          'Join our community and say hello! Join our welcome calls where you can learn what we are about and how you can get involved!'
        }
        CTA="Join Discord"
        isOnboardingCall={true}
      />
      <Card
        label={'Get Involved'}
        icon={<HandRaisedIcon width={50} />}
        description={
          'Vote on MoonDAO proposals, participate in MoonDAO events, and more!'
        }
        CTA="Governance"
        onClick={() => router.push('/governance')}
      />
    </div>
  )
}
