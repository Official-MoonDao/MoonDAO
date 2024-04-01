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
      className={`mt-8 px-12 py-4 w-fit text-lg bg-[#D7594F] text-white ${className} disabled:opacity-50`}
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
