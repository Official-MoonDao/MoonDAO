export function StageContainer({
  children,
  title,
  description,
  className = '',
}: any) {
  return (
    <div
      className={`animate-fadeIn w-full flex flex-col justify-start md:justify-center items-center text-white ${className}`}
    >
      <p className="mb-8 text-white bg-opacity-10 rounded-sm lg:px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] xl:text-left text-lg xl:text-base opacity-80">
        {description}
      </p>
      {children}
    </div>
  )
}
