import React from "react";
import Card from "./Card";
import Frame from "./Frame";

interface CardData {
  icon: string;
  iconAlt: string;
  header: string;
  paragraph: React.ReactNode;
  link?: string;
  hovertext?: string;
  inline?: boolean; 
}

interface CardGridProps {
  cards: CardData[];
  singleCol?: boolean; 
}

const CardGrid: React.FC<CardGridProps> = ({ cards, singleCol = false }) => {
  return (
    <Frame marginBottom="0px" noPadding>
      <div className={`grid gap-[30px] max-w-[1200px] ${singleCol ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
        {cards.map((card, index) => (
          <div key={index} className={`flex ${singleCol ? "max-w-[635px]" : ""}`}>
            <Card 
              icon={card.icon} 
              iconAlt={card.iconAlt}
              header={card.header} 
              paragraph={card.paragraph} 
              link={card.link} 
              hovertext={card.hovertext} 
              inline={card.inline} 
            />
          </div>
        ))}
      </div>
    </Frame>
  );
};

export default CardGrid;