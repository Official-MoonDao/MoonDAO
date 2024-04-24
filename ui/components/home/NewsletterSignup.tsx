import Image from 'next/image'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNewsletterSub } from '../../lib/convert-kit/useNewsletterSub'
import SlideButton from './SlideButton'

export default function NewsletterSignup() {
  const [userEmail, setUserEmail] = useState<any>()

  const subscribe = useNewsletterSub()

  return (
    <div className="p-8 flex flex-col lg:flex-row min-h-[500px] max-w-[1000px] gap-12">
      <div className="w-1/2 flex flex-col justify-center items-center">
        <Image src="/home/white-star.svg" width={400} height={400} alt="" />
        <Image
          className="absolute rotate-0"
          src="/home/splatter-white.svg"
          width={300}
          height={300}
          alt=""
        />
      </div>
      <div className="w-full lg:w-1/2 flex flex-col gap-4 justify-center">
        <h1 className="text-4xl font-GoodTimes">
          JOIN OUR
          <br />
          <span className="bg-white text-black px-2 rounded-sm">MISSION</span>
        </h1>
        <div className="flex flex-col">
          <label className="">Email Address</label>
          <input
            className="mt-4 max-w-[500px] text-black p-2"
            onChange={({ target }) => {
              setUserEmail(target.value)
            }}
          />
        </div>

        <SlideButton
          onClick={() => {
            if (
              !userEmail ||
              userEmail.trim() === '' ||
              !userEmail.includes('@')
            ) {
              toast.error('Please enter a valid email address.')
            } else {
              subscribe(userEmail)
              toast.success(
                'Successfully subscribed! Please check your email to confirm.'
              )
            }
          }}
        >
          Submit
        </SlideButton>
      </div>
    </div>
  )
}
