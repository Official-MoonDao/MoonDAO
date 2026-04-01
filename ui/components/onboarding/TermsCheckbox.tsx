import Link from 'next/link'

export function TermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor="terms"
      className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 select-none ${
        checked
          ? 'border-indigo-500/30 bg-indigo-500/[0.06]'
          : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
      }`}
    >
      <div className="relative flex items-center justify-center mt-0.5 flex-shrink-0">
        <input
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          type="checkbox"
          className="peer sr-only"
          id="terms"
        />
        <div
          className={`w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-900 ${
            checked
              ? 'bg-indigo-500 border-indigo-500'
              : 'border-slate-500 bg-transparent'
          }`}
        >
          {checked && (
            <svg
              className="w-3 h-3 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">
        I have read and accepted the{' '}
        <Link
          href="/terms-of-service"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          Terms and Conditions
        </Link>{' '}
        and the{' '}
        <Link
          href="/privacy-policy"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          Privacy Policy
        </Link>
        .
      </p>
    </label>
  )
}
