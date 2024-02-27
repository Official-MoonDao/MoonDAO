export function StageButton({ onClick, children, isDisabled }: any) {
  return (
    <button
      className={'mt-8 w-[300px] border-2'}
      onClick={onClick}
      disabled={isDisabled}
    >
      {children}
    </button>
  )
}
