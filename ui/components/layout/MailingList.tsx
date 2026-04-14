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
            className="flex-1 px-4 py-3 backdrop-blur-sm transition-all duration-200 sm:rounded-r-none"
            style={{
              background: 'rgba(0, 255, 200, 0.05)',
              border: '1px solid rgba(0, 255, 200, 0.25)',
              color: '#e0fff0',
              borderRadius: '2px',
            }}
            onChange={({ target }) => setUserEmail(target.value)}
            value={userEmail}
          />
          <button
            type="submit"
            className="px-6 py-3 font-medium sm:rounded-l-none transition-all duration-200 whitespace-nowrap uppercase tracking-wider text-sm"
            style={{
              background: '#00ffc8',
              color: '#050505',
              borderRadius: '2px',
              fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif',
              fontWeight: 600,
              boxShadow: '0 0 10px rgba(0, 255, 200, 0.3)',
            }}
          >
            Learn More
          </button>
        </div>
      </div>
    </form>
  )
}
