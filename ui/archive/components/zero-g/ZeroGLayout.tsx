export default function ZeroGLayout({
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
            className={`card min-w-80 md:w-full rounded-2xl border-white-300 border-[0.5px] bg-black bg-opacity-30 shadow-black text-white font-RobotoMono shadow-md overflow-visible lg:px-3`}
          >
            <div className={`card-body items-stretch ${className}`}>
              <h2
                className={`mt-3 card-title text-center font-GoodTimes text-2xl lg:text-3xl font-medium text-transparent bg-clip-text bg-gradient-to-tr from-n3blue to-amber-200`}
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
