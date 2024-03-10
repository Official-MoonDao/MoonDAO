import { useState } from 'react'

export function StageButton({ onClick, children, isDisabled }: any) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <button
      className={
        'mt-8 px-4 py-2 w-[300px] border-2 border-moon-orange text-moon-orange'
      }
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
