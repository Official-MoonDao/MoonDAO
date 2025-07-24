type TabProps = {
  tab: string
  currentTab: string
  setTab: Function
  children: any
  icon?: string | React.ReactNode
  className?: string
}

export default function Tab({
  tab,
  currentTab,
  setTab,
  children,
  icon,
  className,
}: TabProps) {
  return (
    <button
      className={`
          flex justify-center items-center text-white px-4 py-1 rounded-lg transition-all duration-300 h-9 flex-shrink-0 overflow-hidden
          ${currentTab === tab 
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25' 
            : 'hover:bg-white/10 bg-black/20'
          }
          ${className}
        `}
      onClick={() => setTab(tab)}
    >
      <div id="all-tab" className="flex items-center justify-center gap-2">
        {icon && (
          <div
            id="icon-container"
            className={`
            flex-shrink-0 flex items-center justify-center w-4 h-4
            ${currentTab === tab ? 'text-white' : 'text-slate-300'}
            transition-colors duration-200
          `}
          >
            {typeof icon === 'string' ? (
              <img 
                src={icon} 
                alt="" 
                width={16} 
                height={16}
                className="flex-shrink-0 object-contain"
                onError={(e) => {
                  console.error('Failed to load icon:', icon)
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              icon
            )}
          </div>
        )}
        <div id="text-container" className={`${currentTab === tab ? 'text-white font-semibold drop-shadow-sm' : 'text-gray-300 font-medium'} transition-all duration-300 whitespace-nowrap text-sm`}>
          {children}
        </div>
      </div>
    </button>
  )
}
