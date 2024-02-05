export function LoadingSpinner({ children }: any) {
  return (
    <div className="flex flex-col justify-center items-center gap-2">
      <div
        className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
        role="status"
      ></div>
    </div>
  )
}
