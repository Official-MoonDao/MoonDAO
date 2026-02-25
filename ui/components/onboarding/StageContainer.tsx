export function StageContainer({
  children,
  title,
  description,
  className = '',
}: any) {
  return (
    <div
      className={`animate-fadeIn w-full flex flex-col items-center text-white ${className}`}
    >
      <div className="mb-8 w-full max-w-[600px]">
        <h2 className="text-2xl font-GoodTimes text-white mb-2">{title}</h2>
        <p className="text-white/60 text-sm leading-relaxed">
          {description}
        </p>
      </div>
      {children}
    </div>
  )
}
