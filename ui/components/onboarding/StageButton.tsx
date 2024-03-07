export function StageButton({ onClick, children, isDisabled, isLoading }: any) {
  return (
    <button
      className={
        'mt-8 px-4 py-2 w-[300px] border-2 border-moon-orange text-moon-orange'
      }
      onClick={onClick}
      disabled={isDisabled || isLoading}
    >
      {isLoading ? 'loading...' : children}
    </button>
  )
}
