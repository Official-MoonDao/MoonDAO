export function StageContainer({
  children,
  title,
  description,
  className = '',
}: any) {
  return (
    <div
      className={`lg:px-5 animate-fadeIn w-full font-RobotoMono flex flex-col justify-center items-start text-black dark:text-white ${className}`}
    >
      <h1 className="font-GoodTimes text-3xl mb-2">{title}</h1>
      <p className="mb-8 text-[#D7594F] bg-[#D7594F] bg-opacity-10 rounded-sm lg:px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] xl:text-left text-lg xl:text-base">
        {description}
      </p>
      {children}
    </div>
  )
}
