import React from 'react'
import IndexCard from './IndexCard'

interface IndexCardData {
  icon?: string
  iconAlt?: string
  header?: string
  paragraph?: React.ReactNode
  link?: string
  onClick?: Function
  hovertext?: string
  inline?: boolean
  orgimage?: string
  subheader?: string
  entitytype?: string
  orgid?: string
}

interface CardGridProps {
  cards: IndexCardData[]
  singleCol?: boolean
  threeCol?: boolean
}
const IndexCardGrid: React.FC<CardGridProps> = ({
  cards,
  singleCol = false,
  threeCol = false,
}) => {
  return (
    <div className="rounded-bl-[20px] mb-5">        <div
        id="index-grid-container"
        className={`
            grid gap-4 2xl:gap-6 3xl:gap-8
            ${
              singleCol
                ? 'grid-cols-1'
                : threeCol
                ? 'grid-cols-1 lg:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-3'
                : 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-3'
            }
          `}
      >
        {cards.map((card, index) => (
          <div key={index} className={`${singleCol ? 'max-w-[635px]' : ''}`}>
            <IndexCard
              icon={card.icon}
              iconAlt={card.iconAlt}
              header={card.header}
              paragraph={card.paragraph}
              link={card.link}
              onClick={card.onClick}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default IndexCardGrid
