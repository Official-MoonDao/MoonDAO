type TabProps = {
  tab: string
  currentTab: string
  setTab: Function
  children: any
}

export default function Tab({ tab, currentTab, setTab, children }: TabProps) {
  return (
    <button
      className={`px-4 py-2 border-2 rounded-lg ${
        currentTab === tab && 'border-moon-orange text-moon-orange'
      }`}
      onClick={() => setTab(tab)}
    >
      {children}
    </button>
  )
}
