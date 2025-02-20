import Image from 'next/image'

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
          flex flex-grow justify-center text-white px-4 py-2 pb-3 w-[100px]
          ${currentTab === tab ? '' : 'bg-mid-cool opacity-80 text-opacity-50 '}
          ${className}
        `}
      onClick={() => setTab(tab)}
    >
      <div id="all-tab" className="flex items-center justify-start">
        {icon && (
          <div
            id="icon-container"
            className={`
            ${currentTab === tab ? '' : 'opacity-80 '}
          `}
          >
            {typeof icon === 'string' ? (
              <Image src={icon} alt="" width={20} height={20} />
            ) : (
              icon
            )}
          </div>
        )}
        <div id="text-container" className="pl-2">
          {children}
        </div>
      </div>
    </button>
  )
}
