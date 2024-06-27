import Image from "next/image";

type TabProps = {
  tab: string
  currentTab: string
  setTab: Function
  children: any
  icon: string
}

export default function Tab({ tab, currentTab, setTab, children, icon }: TabProps) {
  return (
    <button
      className={`
          flex flex-grow justify-center text-white px-4 py-2 pb-3 
          ${currentTab === tab ? '' : 'bg-mid-cool opacity-80 text-opacity-50 '}
        `}
      onClick={() => setTab(tab)}
      >
      <div id='all-tab' 
        className="flex items-center justify-start"
        >
        <div id="icon-container" 
          className={`
            ${currentTab === tab ? '' : 'opacity-80 '}
          `}  
          >
          <Image src={icon} alt="" width={20} height={20} />
        </div>
        <div id="text-container"
          className="pl-2"
          >
          {children}
        </div>
      </div>
    </button>
  )
}
