import { CK_NEWSLETTER_FORM_ID } from 'const/config'
import { useState } from 'react'
import toast from 'react-hot-toast'
import useSubscribe from '@/lib/convert-kit/useSubscribe'

export function NewsletterSubModal({ setEnabled }: any) {
  const subscribeToNewsletter = useSubscribe(CK_NEWSLETTER_FORM_ID)
  const [email, setEmail] = useState<string>()

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'newsletter-sub-modal-backdrop') setEnabled(false)
      }}
      id="newsletter-sub-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-black/50 backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-lg p-8 w-[300px] md:w-[500px] max-w-lg mx-4">
        <h1 className="text-2xl font-GoodTimes text-white mb-4">SUBSCRIBE</h1>
        <p className="text-white/70 mb-6">
          Enter your email and subscribe to the MoonDAO Newsletter.
        </p>
        <label className="block text-white font-medium mb-2">Email:</label>
        <input
          className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 mb-6"
          placeholder="your@email.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex gap-4 justify-end">
          <button
            className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-all duration-200"
            onClick={() => setEnabled(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all duration-200"
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
            Subscribe
          </button>
        </div>
      </div>
    </div>
  )
}
