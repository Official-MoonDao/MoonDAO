export function StageButton({ onClick, children, isDisabled, isLoading }: any) {
  return (
    <button
      className={'mt-8 px-12 py-4 w-fit text-lg bg-[#D7594F] text-white'}
      onClick={onClick}
      disabled={isDisabled || isLoading}
    >
      {isLoading ? 'loading...' : children}
    </button>
  )
}
