export function StageContainer({
  children,
  title,
  description,
  className = '',
}: any) {
  return (
    <div
      className={`animate-fadeIn w-full flex flex-col justify-start md:justify-center items-center md:items-start md:m-5 text-white ${className}`}
    >
      <p className=" text-white bg-opacity-10 pb-5 rounded-sm pl-0 pr-5 md:pr-10 opacity-80 lg:max-w-[600px]">
        {description}
      </p>
      {children}
    </div>
  )
}
