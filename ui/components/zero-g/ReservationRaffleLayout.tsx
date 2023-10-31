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
            className={` min-w-80 lg:w-full rounded-2xl text-[#071732] dark:text-white inner-container-background font-RobotoMono overflow-visible lg:px-3`}
          >
            <div className={` items-stretch ${className} p-[5%]`}>
              <h2
                className={` text-center text-xl dark:text-white font-GoodTimes lg:text-left`}
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
