import { Suspense, useEffect, useRef, useState } from 'react'
import useMouse from '../../lib/home/useMouse'
import React from 'react';
import Card from './Card';

export default function Hero(props: any) {
  const { mouseX, blur } = useMouse()
  const [modal, setModal] = useState(false)
  const layer1Ref: any = useRef()
  const layer2Ref: any = useRef()

  const cardRef: any = useRef()
  const splatterRef: any = useRef()
  const outlineCardRef: any = useRef()
  const astroRef: any = useRef()

  return ( 
    <div className="CALLOUT2-CONTAINER relative flex flex-col items-start justify-end md:items-start lg:items-start md:justify-end lg:justify-center p-5 mt-[25vh] min-h-[675px] md:min-h-[90vmin]">
        <div className="BACKGROUND-ELEMENTS overflow-visible">  

        </div>
        <div className="HISTORY-CONTAINER flex flex-row flex-wrap justify-center overflow-hidden rounded-[30px] max-w-[1200px]">
            <Card 
                    icon="/assets/icon-dao.svg" 
                    header="Crowdraised Astronauts" 
                    paragraph="Sent the first crowdraised astronaut to space, through a democratically governed onchain election."
            />                                     
            <Card 
                    icon="/assets/icon-dao.svg" 
                    header="Crowdraised Astronauts" 
                    paragraph="Sent the first crowdraised astronaut to space, through a democratically governed onchain election."
            />
            <Card 
                    icon="/assets/icon-dao.svg" 
                    header="Crowdraised Astronauts" 
                    paragraph="Sent the first crowdraised astronaut to space, through a democratically governed onchain election."
                /> 
            <Card 
                    icon="/assets/icon-dao.svg" 
                    header="Crowdraised Astronauts" 
                    paragraph="Sent the first crowdraised astronaut to space, through a democratically governed onchain election."
            />                                     
            <Card 
                    icon="/assets/icon-dao.svg" 
                    header="Crowdraised Astronauts" 
                    paragraph="Sent the first crowdraised astronaut to space, through a democratically governed onchain election."
            />
            <Card 
                    icon="/assets/icon-dao.svg" 
                    header="Crowdraised Astronauts" 
                    paragraph="Sent the first crowdraised astronaut to space, through a democratically governed onchain election."
                />                 
        </div>
    </div>
  )
}
