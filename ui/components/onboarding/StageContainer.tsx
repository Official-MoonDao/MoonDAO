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
      <div className="mb-6 bg-gradient-to-r from-slate-700/30 to-slate-800/40 rounded-2xl border border-slate-600/30 p-6 w-full max-w-[600px]">
        <h2 className="text-2xl font-GoodTimes text-white mb-3">{title}</h2>
        <p className="text-slate-300 text-base leading-relaxed">
          {description}
        </p>
      </div>
      {children}
    </div>
  )
}
