export function StageContainer({ children, title, description }: any) {
  return (
    <div className="animate-fadeIn w-[336px] sm:w-[400px] lg:w-full font-RobotoMono flex flex-col justify-center items-center text-black dark:text-white">
      <h1 className="font-GoodTimes text-3xl mb-8">{title}</h1>
      <p className="mb-8">{description}</p>
      {children}
    </div>
  )
}
