interface ProgressBarProps {
  progress: number // Value between 0 and 100
  height?: string
  label?: string
  padding?: string
}

export default function ProgressBar({
  progress,
  height = '8px',
  label,
  padding = '2px',
}: ProgressBarProps) {
  return (
    <div
      className="relative w-full rounded-full bg-gradient-to-l from-[#425eeb] to-[#6d3f79] overflow-hidden"
      style={{ height: `calc(${height} + ${padding} * 2)` }}
    >
      <div
        className="absolute inset-0 m-[2px] rounded-full bg-[#020617] overflow-hidden"
        style={{ margin: padding }}
      >
        <div
          className="h-full  bg-gradient-to-l from-[#425eeb] to-[#6d3f79] transition-all duration-300 relative"
          style={{ width: `${Math.min(Math.max(progress, 10), 100)}%` }}
        >
          {label && (
            <div className="absolute inset-y-0 right-2 flex items-center">
              <span className="text-xs font-medium text-white">{label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
