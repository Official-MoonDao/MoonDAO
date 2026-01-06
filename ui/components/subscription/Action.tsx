import React from 'react'

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
      className={`flex-1 bg-slate-600/20 rounded-xl p-4 transition-all duration-200 cursor-pointer group hover:bg-slate-600/30 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-600/50 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h3 className="font-semibold text-white text-sm leading-tight">{title}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  )
}
