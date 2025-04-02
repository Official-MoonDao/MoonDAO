interface ProgressBarProps {
  progress: number // Value between 0 and 100
  height?: string
  label?: string
  padding?: string
  compact?: boolean
}

export default function ProgressBar({
  progress,
  height = '8px',
  label,
  padding = '2px',
  compact = false,
}: ProgressBarProps) {
  return (
    <div
      className="relative w-full rounded-full bg-gradient-to-l from-[#425eeb] to-[#6d3f79]"
      style={{ height: `calc(${height} + ${padding} * 2)` }}
    >
      <div
        className="absolute inset-0 m-[2px] rounded-full bg-[#020617] overflow-hidden"
        style={{ margin: padding }}
      >
        <div
          className="h-full  bg-gradient-to-l from-[#425eeb] to-[#6d3f79] transition-all duration-300 relative"
          style={{
            width: `${Math.min(Math.max(progress, compact ? 0 : 10), 100)}%`,
          }}
        >
          {label && (
            <div
              className={`absolute inset-y-0 ${
                progress < 20 ? 'left-full md:left-auto ml-1' : '-right-[10px]'
              } flex items-center`}
            >
              <span className="text-[10%] text-white min-w-[50px]">
                {label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
