import { useState } from 'react'

export function StageButton({
  onClick,
  children,
  isDisabled,
  className = '',
}: any) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <button
      className={`mt-5 mb-10 px-5 py-3 rounded-[2vmax] rounded-tl-[10px] text-lg gradient-2 text-white ${className} disabled:opacity-50`}
      onClick={async () => {
        setIsLoading(true)
        await onClick()
        setIsLoading(false)
      }}
      disabled={isDisabled || isLoading}
    >
      {isLoading ? 'loading...' : children}
    </button>
  )
}
