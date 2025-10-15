import Link from 'next/link'
import React, { useState } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import toast from 'react-hot-toast'

export function ZeroGContact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  const [verified, setVerified] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  function resetContactForm() {
    setName('')
    setEmail('')
    setPhone('')
    setMessage('')
    setVerified(false)
  }

  async function submitContactForm() {
    setIsLoading(true)
    if (!email.includes('@') || name.trim() === '')
      return toast.error('Please fill out all required fields.')
    if (!verified) return toast.error("Please verify you're not a robot.")
    else {
      try {
        const res = await fetch('/api/nodemailer/zero-g-contact', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            phone,
            message,
          }),
        })
        toast.success('Message sent!')
        resetContactForm()
      } catch (e: any) {
        toast.error('Message failed to send.')
        console.error(e)
      }
    }
    setIsLoading(false)
  }

  return (
    <div className="text-black dark:text-white">
      <div className="mt-2 p-4 w-full flex flex-col items-center gap-2 duration-300 h-full bg-[#1d1d1d50] rounded-md">
        <div className="w-full">
          <label className="font-semibold">
            Name : <span className="text-[tomato]">*</span>
          </label>
          <input
            className="w-full rounded-md px-2 dark:bg-[#ffffff25]"
            onChange={({ target }) => setName(target.value)}
            value={name}
          />
        </div>
        <div className="w-full">
          <label className="font-semibold">
            Email : <span className="text-[tomato]">*</span>
          </label>
          <input
            className="w-full rounded-md px-2 dark:bg-[#ffffff25]"
            onChange={({ target }) => setEmail(target.value)}
            value={email}
          />
        </div>
        <div className="w-full">
          <label className="font-semibold">Phone :</label>
          <input
            className="w-full rounded-md px-2 dark:bg-[#ffffff25]"
            onChange={({ target }) => setPhone(target.value)}
            value={phone}
          />
        </div>
        <div className="w-full">
          <label className="font-semibold">Message :</label>
          <textarea
            className="w-full h-32 rounded-md px-2 dark:bg-[#ffffff25]"
            onChange={({ target }) => setMessage(target.value)}
            style={{ resize: 'none' }}
            value={message}
          ></textarea>
        </div>
        <div className="mt-2">
          {email.includes('@') &&
            React.createElement(ReCAPTCHA as any, {
              sitekey: process.env.NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY as string,
              onChange: (e: any) => setVerified(true),
            })}
        </div>
        <button
          className={`mt-4 py-3 text-white bg-moon-orange font-RobotoMono w-full duration-[0.6s] ease-in-ease-out text-1xl hover:scale-105`}
          onClick={submitContactForm}
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Submit'}
        </button>

        <Link
          className="mt-2"
          href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </Link>
      </div>
    </div>
  )
}
