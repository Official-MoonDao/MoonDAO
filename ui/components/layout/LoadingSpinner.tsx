export function LoadingSpinner({
  id,
  children,
  className = '',
  width = 'w-8',
  height = 'h-8',
}: any) {
  return (
    <div
      id={id}
      className={`flex flex-col justify-center items-center gap-2 ${className}`}
    >
      <div
        className={`inline-block ${width} ${height} animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]`}
        role="status"
      ></div>
    </div>
  )
}
