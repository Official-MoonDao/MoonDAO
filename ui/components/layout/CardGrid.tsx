import React from "react";
import Card from "./Card";
import Frame from "./Frame";

interface CardData {
  icon?: string;
  iconAlt?: string;
  header?: string;
  paragraph?: React.ReactNode;
  link?: string;
  hovertext?: string;
  inline?: boolean; 
  orgimage?: string;
  subheader?: string;
  entitytype?:string;
  orgid?:string;
}

interface CardGridProps {
  cards: CardData[];
  singleCol?: boolean; 
  threeCol?: boolean;
}

const CardGrid: React.FC<CardGridProps> = ({ cards, singleCol = false, threeCol = false }) => {
  return (
    <Frame 
      marginBottom="0px" 
      noPadding 
      bottomLeft="20px">
      <div id="grid-container" 
        className={`
          grid gap-[30px] max-w-[1200px] 
          ${singleCol ? "grid-cols-1" : 
          threeCol ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-2"}
        `}
        >
        {cards.map((card, index) => (
          <div 
            key={index} 
            className={`flex 
              ${singleCol ? "max-w-[635px]" : ""}
            `}
            >
            <Card 
              icon={card.icon} 
              iconAlt={card.iconAlt}
              header={card.header} 
              paragraph={card.paragraph} 
              link={card.link} 
              hovertext={card.hovertext} 
              inline={card.inline} 
              orgimage={card.orgimage}
              subheader={card.subheader}
              entitytype={card.entitytype}
              orgid={card.orgid}
            />
          </div>
        ))}
      </div>
    </Frame>
  );
};

export default CardGrid;