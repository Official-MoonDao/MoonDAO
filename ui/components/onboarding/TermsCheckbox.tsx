import Link from 'next/link'

export function TermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex flex-row items-center mt-6 p-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl">
      <label
        className="relative flex items-center p-3 rounded-full cursor-pointer"
        htmlFor="terms"
      >
        <input
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          type="checkbox"
          className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-400 transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-slate-500 before:opacity-0 before:transition-opacity checked:border-slate-300 checked:bg-slate-700 checked:before:bg-slate-700 hover:before:opacity-10"
          id="terms"
        />
        <span className="absolute text-white transition-opacity opacity-0 pointer-events-none top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 peer-checked:opacity-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            ></path>
          </svg>
        </span>
      </label>
      <label className="mt-px font-light text-slate-300 select-none max-w-[550px]" htmlFor="terms">
        <p className="text-white">
          I have read and accepted the
          <Link
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 transition-colors"
            href="/terms-of-service"
          >
            {' '}
            Terms and Conditions{' '}
          </Link>{' '}
          and the{' '}
          <Link
            className="text-sky-400 hover:text-sky-300 transition-colors"
            href="/privacy-policy"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </label>
    </div>
  )
}
