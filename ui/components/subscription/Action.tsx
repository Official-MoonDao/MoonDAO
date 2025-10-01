type ActionProps = {
  title: string
  description: string | React.ReactNode
  icon: any
  onClick?: () => void
  disabled?: boolean
}

export default function Action({
  title,
  description,
  icon,
  onClick,
  disabled = false,
}: ActionProps) {
  return (
    <div
      data-testid="action-container"
      className={`bg-slate-600/20 rounded-xl p-4 transition-colors cursor-pointer group ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600/30'
      }`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
          {icon}
        </div>
        <h3 className="font-bold text-white text-sm">{title}</h3>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{description}</p>
    </div>
  )
}
