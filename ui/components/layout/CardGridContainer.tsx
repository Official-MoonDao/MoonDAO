export default function CardGridContainer({
  children,
  className = '',
  noGap = false,
  center = false,
}: any) {
  return (
    <div
      id="card-grid-container"
      className={`h-full w-full mb-10 grid grid-cols-1 lg:grid-cols-2 mt-5 ${
        noGap ? '' : 'gap-5'
      } ${
        center ? 'items-center' : ''
      } [&>*]:self-stretch [&>*]:bg-dark-cool [&>*]:rounded-2xl [&>*]:border-b-2 [&>*]:border-[#020617] ${className}`}
    >
      {children}
    </div>
  )
}
