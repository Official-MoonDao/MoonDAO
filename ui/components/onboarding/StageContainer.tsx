export function StageContainer({ children, title, description }: any) {
  return (
    <div className="px-12 animate-fadeIn w-[336px] sm:w-[400px] md:w-full font-RobotoMono flex flex-col justify-center items-center md:items-start text-black dark:text-white">
      <h1 className="font-GoodTimes text-3xl mb-8">{title}</h1>
      <p className="mb-4 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] xl:text-left text-sm xl:text-base">
        {description}
      </p>
      {children}
    </div>
  )
}
