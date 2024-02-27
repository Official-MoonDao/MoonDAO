import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNewsletterSub } from '../../lib/convert-kit/useNewsletterSub'

export function NewsletterSubModal({ setEnabled }: any) {
  const subscribeToNewsletter = useNewsletterSub()
  const [email, setEmail] = useState<string>()

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'newsletter-sub-modal-backdrop') setEnabled(false)
      }}
      id="newsletter-sub-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-[300px] md:w-[500px] h-auto p-8 bg-background-light dark:bg-background-dark rounded-md">
        <h1 className="text-2xl">Subscribe</h1>
        <p className="opacity-50 font-[Lato]">
          {'Enter your email and subscribe to the MoonDAO Newsletter.'}
        </p>
        <label>Email :</label>
        <input
          className="w-full text-lg rounded-sm px-2 bg-[#4E4E4E50]"
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex w-full justify-between pt-8">
          <button
            type="button"
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={async () => {
              if (!email || email.trim() === '' || !email.includes('@')) {
                return toast.error('Please enter a valid email')
              }
              const subRes = await subscribeToNewsletter(email)
              if (subRes.ok) {
                toast.success(
                  'Successfully subscribed to the newsletter! Open your email and confirm your subscription.'
                )
                setEnabled(false)
              }
            }}
          >
            Submit
          </button>
          <button
            className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-[#2A2A2A] text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={() => setEnabled(false)}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
