import { CK_NEWSLETTER_FORM_ID } from 'const/config'
import { useState } from 'react'
import toast from 'react-hot-toast'
import useSubscribe from '@/lib/convert-kit/useSubscribe'

export default function MailingList() {
  const [userEmail, setUserEmail] = useState<any>('')
  const [isEmailFocused, setIsEmailFocused] = useState(false)
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
      <div
        id="mailing-list-form-container"
        className="mb-[60px] lg:mb-0 overflow-hidden"
      >
        <div
          id="mailing-list-form"
          className="flex flex-col md:flex-row md:inline-flex rounded-[3vmax] md:rounded-[5vmax] rounded-tl-[10px] md:rounded-tl-[20px] overflow-hidden"
        >
          <div
            id="email-field-container"
            className="mailinglist-bg flex min-w-[200px] md:min-w-[260px] overflow-hidden"
          >
            <input
              id="email-field"
              className={`
                flex-grow overflow-hidden text-clip single-input pt-4 pb-4 px-5 bg-dark-cool focus:outline-none 
              `}
              type="email"
              placeholder="Enter your email"
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
              onChange={({ target }) => setUserEmail(target.value)}
              value={userEmail}
            />
          </div>
          <div id="button-container" className="bg-dark-cool">
            <button
              id="button"
              type="submit"
              className={`single-submit pt-4 pb-4 px-5 w-full md:w-[auto] bg-white focus:outline-none text-white text-center md:text-left gradient-12 min-w-[150px] 
              ${
                isEmailFocused ? 'rounded-tr-[20px] md:rounded-tl-[20px]' : ''
              }`}
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
