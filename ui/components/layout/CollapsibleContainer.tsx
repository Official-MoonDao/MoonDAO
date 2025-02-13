import React, { useState } from 'react'

type CollapsibleContainerProps = {
  children: React.ReactNode
  minHeight?: string
  rightAlign?: boolean
}

function CollapsibleContainer({
  children,
  minHeight = '0px',
  rightAlign,
}: CollapsibleContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="relative mb-8 pb-8 lg:pb-0">
      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          height: isExpanded ? 'auto' : minHeight,
        }}
      >
        <div>{children}</div>
      </div>
      <div
        className={`absolute bottom-0 md:bottom-[-25px] ${
          rightAlign ? 'right-0' : 'left-0'
        } w-full z-20`}
      >
        <button
          onClick={toggleExpand}
          className="mt-4 px-2 gradient-2 rounded-full z-[100]"
        >
          {isExpanded ? 'See Less' : 'See More'}
        </button>
      </div>
    </div>
  )
}

export default CollapsibleContainer
