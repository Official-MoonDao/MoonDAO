function TimelineViewTab({
  view,
  currentView,
  setView,
  children,
}: {
  view: string
  currentView: string
  setView: any
  children: React.ReactNode
}) {
  return (
    <button
      className={`${currentView === view && 'underline'}`}
      onClick={() => setView(view)}
    >
      {children?.toString().toUpperCase()}
    </button>
  )
}

export default function MissionTimelineViewSelector({
  view,
  setView,
}: {
  view: 'volume' | 'balance' | 'trendingScore'
  setView: (view: 'volume' | 'balance' | 'trendingScore') => void
}) {
  return (
    <div className="w-full flex gap-4">
      <TimelineViewTab view={'volume'} currentView={view} setView={setView}>
        {'Volume'}
      </TimelineViewTab>
      <TimelineViewTab view={'balance'} currentView={view} setView={setView}>
        {'In Juicebox'}
      </TimelineViewTab>
      <TimelineViewTab
        view={'trendingScore'}
        currentView={view}
        setView={setView}
      >
        {'Trending'}
      </TimelineViewTab>
    </div>
  )
}
