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
            !maxWidthClassNames ? 'w-full max-w-xl' : maxWidthClassNames
          }
        >
          <div
            className={` min-w-80 lg:w-full rounded-2xl text-white bg-[#071732] font-RobotoMono overflow-visible lg:px-3`}
          >
            <div className={` items-stretch ${className} p-[5%]`}>
              <h2
                className={` text-center text-xl text-white font-GoodTimes lg:text-left`}
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
