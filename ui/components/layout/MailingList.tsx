import { CK_NEWSLETTER_FORM_ID } from 'const/config'
import { useState } from 'react'
import toast from 'react-hot-toast'
import useSubscribe from '@/lib/convert-kit/useSubscribe'

type MailingListProps = {
  submitLabel?: string
  /** Landing pages pass this so the submit control stays secondary to the section CTA. */
  quietSubmit?: boolean
  compact?: boolean
}

export default function MailingList({
  submitLabel = 'Learn More',
  quietSubmit = false,
  compact = false,
}: MailingListProps = {}) {
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
      <div className={compact ? '' : 'mb-[60px] lg:mb-0'}>
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
            className={
              quietSubmit
                ? 'whitespace-nowrap rounded-lg border border-white/25 bg-transparent px-5 py-3 text-sm font-medium text-white/80 transition-colors duration-200 hover:border-white/45 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20 sm:rounded-l-none'
                : 'whitespace-nowrap rounded-lg bg-white px-6 py-3 font-medium text-black transition-all duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white/30 sm:rounded-l-none'
            }
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
