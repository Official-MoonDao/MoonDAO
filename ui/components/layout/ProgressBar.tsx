interface ProgressBarProps {
  progress: number // Value between 0 and 100
  height?: string // Optional height prop
  label?: string // Optional label to display
}

export default function ProgressBar({
  progress,
  height = '8px',
  label,
}: ProgressBarProps) {
  return (
    <div
      className="relative w-full rounded-full border bg-black/20 overflow-hidden border-light-warm"
      style={{ height }}
    >
      <div
        className="h-full rounded-full gradient-2 transition-all duration-300"
        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
      >
        {label && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-white">{label}</span>
          </div>
        )}
      </div>
    </div>
  )
}
