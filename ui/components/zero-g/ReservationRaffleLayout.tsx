export default function ReservationRaffleLayout({
  children,
  title,
  loading,
  maxWidthClassNames,
  className = '',
}: any) {
  return (
    <>
      {!loading ? (
        <div
          className={
            !maxWidthClassNames ? 'max-w-md md:max-w-xl' : maxWidthClassNames
          }
        >
          <div
            className={`card min-w-80 md:w-full rounded-2xl border-white border-[0.5px] bg-black bg-opacity-50  text-white font-RobotoMono shadow-md overflow-visible lg:px-3`}
          >
            <div className={`card-body items-stretch ${className}`}>
              <h2
                className={`card-title text-center font-display tracking-wider text-2xl lg:text-3xl font-semibold text-yellow-50`}
              >
                {title}
              </h2>
              {children}
            </div>
          </div>
        </div>
      ) : (
        <button className="btn btn-square btn-ghost btn-disabled bg-transparent loading"></button>
      )}
    </>
  )
}
