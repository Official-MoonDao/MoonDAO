import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNewsletterSub } from '../../lib/convert-kit/useNewsletterSub'

export default function MailingList() {
  const [userEmail, setUserEmail] = useState<any>('')

  const subscribe = useNewsletterSub()

  return (
    <form
      id="mailinglist-form"
      onSubmit={(e: any) => {
        e.preventDefault()
        if (!userEmail || userEmail.trim() === '' || !userEmail.includes('@')) {
          toast.error('Please enter a valid email address')
        } else {
          subscribe(userEmail)
          toast.success('Subscribed! Check your email to confirm.', {
            duration: 3000,
          })
          setUserEmail('')
        }
      }}
    >
      <div className="flex flex-col bg-dark-cool items-center max-w-[450px] md:flex-row rounded-[2vmax] rounded-tl-[10px] mb-[60px] lg:mb-0 overflow-hidden">
        <input
          id="email-field"
          className="pt-4 pb-4 px-5 bg-dark-cool focus:outline-none focus:ring-white-500 px-3 py-2 w-full"
          type="email"
          placeholder="Enter your email"
          onChange={({ target }) => setUserEmail(target.value)}
          value={userEmail}
        />
        <button
          id="mailinglist-form-button"
          type="submit"
          className="pt-4 pb-4 px-5 w-full md:w-[auto] bg-white duration-500 focus:outline-none text-white text-center md:text-left gradient-2 min-w-[150px] rounded-tr-[20px]"
        >
          Learn More
        </button>
      </div>
    </form>
  )
}
