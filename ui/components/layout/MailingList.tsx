import { CK_NEWSLETTER_FORM_ID } from 'const/config'
import { useState } from 'react'
import toast from 'react-hot-toast'
import useSubscribe from '@/lib/convert-kit/useSubscribe'

export default function MailingList() {
  const [userEmail, setUserEmail] = useState<any>('')
  const subscribe = useSubscribe(CK_NEWSLETTER_FORM_ID)

  return (
    <form
      id="mailinglist-form"
      onSubmit={(e: any) => {
        e.preventDefault()
        if (!userEmail || userEmail.trim() === '' || !userEmail.includes('@')) {
          toast.error('Please enter a valid email address.')
        } else {
          subscribe(userEmail)
          toast.success('Subscribed! Check your email to confirm.', {
            duration: 3000,
          })
          setUserEmail('')
        }
      }}
    >
      <div className="mb-[60px] lg:mb-0">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 max-w-md">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg sm:rounded-r-none text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all duration-200"
            onChange={({ target }) => setUserEmail(target.value)}
            value={userEmail}
          />
          <button
            type="submit"
            className="px-6 py-3 bg-white text-black font-medium rounded-lg sm:rounded-l-none hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200 whitespace-nowrap"
          >
            Learn More
          </button>
        </div>
      </div>
    </form>
  )
}
