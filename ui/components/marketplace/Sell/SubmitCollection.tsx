import { useRef, useState } from 'react'
import { useClickOutside } from '../../../lib/marketplace/marketplace-utils/hooks'

export default function SubmitCollection() {
  const submitRef: any = useRef()
  const [enabled, setEnabled] = useState<boolean>(false)

  useClickOutside(submitRef, enabled, setEnabled)

  return (
    <div
      className={`w-full flex justify-center ${
        enabled ? 'md:h-[500px]' : 'h-[200px]'
      } ease-in-ease-out duration-500`}
      ref={submitRef}
    >
      {!enabled ? (
        <div className="w-full flex flex-col gap-2 justify-center items-center">
          <button
            className="hover:!text-title-light 
            bg-slate-300
            dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark w-3/4 max-w-[600px]"
            onClick={() => setEnabled(true)}
          >
            Submit a Collection
          </button>
          <p className="text-[90%] opacity-60 w-3/4 md:w-1/3 text-center">
            {
              "Don't see your assets? Apply to have your collection added to the marketplace \n (you must be the owner of the collection)"
            }
          </p>
        </div>
      ) : (
        <div className="animate-fade-in w-3/4 flex flex-col justify-center items-center rounded-lg light">
          <button
            className="relative text-moon-secondary text-3xl w-full text-right pr-[7%] top-[8%] md:top-[15%] hover:text-4xl transition-all duration-150"
            onClick={() => setEnabled(false)}
          >
            ✖
          </button>
          <iframe
            className="w-full min-h-[600px] rounded-lg"
            src={
              'https://circles.spect.network/r/ad645285-65ef-4aec-b314-d8d0659cccd8/embed?mode=light'
            }
          />
        </div>
      )}
    </div>
  )
}
