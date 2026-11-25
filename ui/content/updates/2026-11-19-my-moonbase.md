---
title: "My Moonbase: build a lunar base from your predictions"
description: "Predict who wins each lunar race, then place that hardware on your own plot, connect it with roads and build the base you think is coming."
date: 2026-11-19
author: MoonDAO
authorRole: Executive Branch
category: Update
image: /assets/updates/my-moonbase/hero.jpg
imageAlt: A lunar base seen from ground level, with a Starship lander on its pad, solar arrays, a domed habitat, rovers and a grid of roads on grey regolith under a black sky
imageCaption: "An example base built from one pick in each of the eleven races."
tags:
  - moonbase
  - deprize
  - predictions
featured: false
draft: false
---

[Moon Base Zero](/moonbase) shows every team racing to build the first lunar base: the landers, rovers, reactors and habitats, each standing in the race it is trying to win. It is one shared model, and it shows all of the competitors at once.

[My Moonbase](/moonbase/mine) is the other half. It gives you an empty plot of lunar ground and one rule: **you can only build with the hardware you have predicted to win.** Pick the lander you think makes the next landing and it is yours to set down. Pick a reactor, a habitat and a rover and you have the start of a base. Then lay roads between them and fill in the rest.

The result is a picture of your forecast. Two people who disagree about who lands first, or whose reactor works, end up with different bases.

```stats
{
 "items": [
  {"value": "11", "label": "races you can predict"},
  {"value": "47", "label": "pieces of hardware to unlock"},
  {"value": "240 m", "label": "square plot, on a 6 m grid"},
  {"value": "Free", "label": "to predict and to build"}
 ]
}
```

<aside data-title="Key takeaways">

- **Your predictions are the parts list.** Each race you predict unlocks the hardware you picked. Nothing else can be placed, so the base only ever shows what you actually think.
- **You predict without leaving your base.** Every race opens in the side panel with its competitors and a Predict button. The hardware unlocks as soon as you save.
- **Roads and scenery are yours to arrange.** Two clicks draw a road. Eleven scenery pieces, from street lights to solar arrays, can be placed as often as you like.
- **Changing your mind doesn't wreck the base.** Switch a pick and the old hardware leaves, but its lot stays marked on the ground until you decide what to do with it.
- **Your base is saved to your account.** Sign in, or make a prediction, and the layout saves as you build. Open My Moonbase on another device and it is waiting, and Share gives you a link anyone can open.

</aside>

```screens
{
 "figure": "The builder",
 "title": "A base built from eleven picks",
 "subtitle": "The panel on the left lists the hardware you have unlocked, race by race. The toolbar at the bottom switches between selecting, drawing roads, placing scenery and erasing.",
 "items": [
  {"src": "/assets/updates/my-moonbase/builder.jpg", "alt": "My Moonbase showing a base named Shackleton Yard: a Starship lander on a round pad, a domed habitat, a reactor with tall radiator panels and smaller hardware joined by roads, with a panel on the left listing the predicted hardware and a toolbar along the bottom", "url": "moondao.com/moonbase/mine", "href": "/moonbase/mine"}
 ],
 "source": "Screenshot of a preview build, 19 November 2026. The base shown is an example with one pick in every race."
}
```

## How it works

1. **Open a race.** The panel lists the eleven races you can predict, from the next landing to the first habitat. Open one to see who is competing.
2. **Predict the winner.** Press Predict next to a competitor and confirm. It is a free forecast, the same one you would make in Moon Base Zero or on a DePrize page.
3. **Place the hardware.** The piece you picked appears under "Your hardware". Press Place, then click the plot to set it down. You get one of each, because there is only one of each.
4. **Connect it.** Draw roads, add lights, power and a rover depot, and move things around until it looks like somewhere you would land.

You can make one pick per race, so a complete base has eleven predictions behind it. Two vehicles compete in two races each: Starship HLS in both Touchdown and the first commercial crewed landing, and Chang'e-7 in both Touchdown and Water Ice. Pick either one in either race and it is unlocked.

## Predict without leaving your base

You don't have to go back to Moon Base Zero to make a pick. Open a race in the panel and its competitors are listed there, each with a Predict button. Confirm, and the hardware is in your list and ready to place.

```screens
{
 "figure": "Predicting",
 "title": "A race, opened in the panel",
 "subtitle": "Touchdown's seven competitors, listed where you build. Each race also links to Moon Base Zero for its odds and details.",
 "items": [
  {"src": "/assets/updates/my-moonbase/predict-in-place.jpg", "alt": "The My Moonbase hardware panel with the Touchdown race open, listing seven landers from Peregrine and Griffin to Starship HLS, each with a Predict button, beside a half-built base", "url": "moondao.com/moonbase/mine", "href": "/moonbase/mine"}
 ],
 "source": "Screenshot of a preview build, 19 November 2026."
}
```

A few details:

- **You don't need an account to start.** A free prediction made while signed out is kept with that browser. Sign in and the predictions already saved from your wallet are there too.
- **Earlier predictions count.** If you have already predicted in Moon Base Zero or on the [Touchdown page](/deprize/arb/1), that hardware is waiting when you arrive.
- **ETH positions count too.** Touchdown is the one race with a live market. If you hold a position on a lander there, that lander is unlocked.
- **You can change a pick.** Predicted races have a Change link that reopens the list.

## Roads, scenery and the grid

The plot is 240 m on a side, divided into 6 m cells. Everything snaps to that grid.

- **Roads.** Choose Road, click where it starts and click where it ends. A straight line draws a straight road; anything else draws a corner. Roads join up where they meet.
- **Scenery.** Eleven pieces in three groups. Power and light: street light, solar array. Logistics: rover charging bay, rover depot, excavator, cargo crates, cable reel, spare parts, regolith bricks. Terrain: boulder, large boulder. Place as many as you like.
- **Editing.** Click anything you have placed to rotate, move or remove it. Erase clears whatever you click. Undo and redo cover every change, and Clear starts over after asking first.
- **Getting around.** Drag to move, right-drag to turn, scroll to zoom. Find, next to a placed piece, flies the camera to it.

```screens
{
 "figure": "Building",
 "title": "Drawing roads on the grid",
 "subtitle": "With the Road tool selected the 6 m grid appears. Two clicks set the start and the end.",
 "items": [
  {"src": "/assets/updates/my-moonbase/roads.jpg", "alt": "My Moonbase with the Road tool selected: a grid drawn over the plot, a road network joining a Starship pad, a habitat, landers and rovers, and a prompt reading Click where the road starts", "url": "moondao.com/moonbase/mine", "href": "/moonbase/mine"}
 ],
 "source": "Screenshot of a preview build, 19 November 2026."
}
```

Hardware comes in very different sizes, and the plot respects that. A rover or a small lander takes one cell. Starship HLS and its pad take a block of 11 by 11, which is 66 m across. The NASA Moon Base habitat takes 7 by 7. A plot holds up to 200 pieces of hardware and scenery, plus as much road as you want to draw.

## What you can unlock

The eleven races cover the main steps toward a working base: getting there, moving around, surviving the night, making power, making oxygen, finding water, building pads, living there and staying in contact.

```chart
{
 "type": "bars",
 "figure": "Figure 1",
 "title": "Hardware in each race",
 "subtitle": "Number of competitors you can pick between. Your pick is the piece you unlock.",
 "panels": [
  {"name": "Competitors", "values": [7, 2, 5, 3, 7, 3, 4, 3, 5, 5, 5]}
 ],
 "rows": [
  {"label": "Touchdown", "color": "#60a5fa"},
  {"label": "Crew lander", "color": "#60a5fa"},
  {"label": "First Tracks", "color": "#60a5fa"},
  {"label": "Crew rover", "color": "#60a5fa"},
  {"label": "Night Shift", "color": "#60a5fa"},
  {"label": "Fission", "color": "#60a5fa"},
  {"label": "Oxygen", "color": "#60a5fa"},
  {"label": "Water Ice", "color": "#60a5fa"},
  {"label": "Pads", "color": "#60a5fa"},
  {"label": "Habitat", "color": "#60a5fa"},
  {"label": "Comms", "color": "#60a5fa"}
 ],
 "source": "MoonDAO Lunar Atlas, 19 November 2026. 49 entries across 11 races; 47 distinct pieces of hardware, because two vehicles each compete in two races."
}
```

The full list, race by race, is in the appendix.

## When you change your mind

Forecasts change, and the base is built to cope with that. If you switch your pick in a race, the hardware you no longer back comes off the plot, but nothing is deleted. Its footprint stays where it was, outlined in amber.

From there you have three options. Predict that competitor again and it returns to the same spot. Place your new pick somewhere else and leave the lot empty. Or remove the lot and reuse the ground.

```screens
{
 "figure": "Changing a pick",
 "title": "Held lots",
 "subtitle": "The same base without a pick for the crewed landing or the habitat. The Starship pad and the habitat leave amber outlines, and the roads around them stay put.",
 "items": [
  {"src": "/assets/updates/my-moonbase/held-lots.jpg", "alt": "My Moonbase showing two empty amber-outlined lots where the Starship pad and the habitat stood, with the rest of the base and its roads unchanged", "url": "moondao.com/moonbase/mine", "href": "/moonbase/mine"}
 ],
 "source": "Screenshot of a preview build, 19 November 2026."
}
```

## How it's saved

- **Predictions follow your wallet.** They are saved the same way as every other free forecast on MoonDAO, so they show up in Moon Base Zero, on the race pages and here.
- **The layout is saved to your account too.** Where you put things, your roads and the name of your base are saved with the same account as your predictions. Open My Moonbase on another device, sign in, and the base is there as you left it.
- **It saves as you go.** There is no save button. A couple of seconds after you stop editing, the change is sent. The header reads "Saved to your account" once it lands, and if a save fails it says so, keeps your work in the browser and offers Try again.
- **You don't need to sign in first.** A base built while signed out is kept in this browser. Make a free prediction or sign in, and it moves to your account.
- **If two copies disagree, you choose.** Edit the base on two devices and the builder notices. It asks whether to keep the one on screen or load the one saved to your account, and does not overwrite either until you answer.
- **Share it with a link.** Press Share in the header to get a link to your base and a picture of it. Anyone with the link can look around and see which hardware you predicted, but only you can change it.

## Build yours

Start with the race you have the strongest view on. One prediction is enough to put the first piece down.

```cta
{
 "eyebrow": "My Moonbase · free to build",
 "title": "Predict the winners. Build the base.",
 "body": "Pick who you think wins each lunar race and place that hardware on your own plot. Predicting is free, and you can change your mind.",
 "points": [
  "Open a race and predict a winner. It costs nothing.",
  "Place what you picked, then add roads, power and scenery.",
  "On Touchdown, back your pick with ETH where eligible. About 5% of every bet grows the prize for the winning team."
 ],
 "actions": [
  {"label": "Build your Moonbase", "href": "/moonbase/mine", "primary": true},
  {"label": "Explore Moon Base Zero", "href": "/moonbase"},
  {"label": "How DePrize works", "href": "/deprize/how-it-works"}
 ],
 "image": {"src": "/assets/updates/my-moonbase/predict-window.jpg", "alt": "The Predict window in My Moonbase, offering a free MOONEY forecast for Blue Moon MK1 Cargo Lander, with options to sign in or add ETH to the prediction"},
 "note": "Not financial advice. Adding ETH to a prediction is available in eligible jurisdictions."
}
```

## Appendix: every race and its hardware

<details>
<summary>Getting there and getting around</summary>

**Touchdown: next successful lunar landing**

- Peregrine & Griffin Landers (Voyager Lunar Systems)
- Nova-C Lander (Intuitive Machines)
- Blue Ghost (Firefly Aerospace)
- Blue Moon MK1 Cargo Lander (Blue Origin)
- Chang'e-7 (CNSA)
- HAKUTO-R & ULTRA Landers (ispace)
- Starship Human Landing System (SpaceX)

**First commercial crewed lunar landing**

- Starship Human Landing System (SpaceX)
- Blue Moon MK2 Crewed Lander (Blue Origin)

**First Tracks: first commercial rover egress and drive**

- FLIP (Venturi Astrolab)
- CubeRover (Voyager Lunar Systems)
- MAPP (Lunar Outpost)
- Tenacious (ispace)
- Iris-class (Carnegie Mellon)

**First crewed lunar terrain vehicle in service**

- CLV-1 (Venturi Astrolab)
- Pegasus LTV (Lunar Outpost)
- Moon RACER LTV (Intuitive Machines)

</details>

<details>
<summary>Power and resources</summary>

**Night Shift: first machine that works through a lunar night**

- Harmonia (Zeno Power)
- NITE (Voyager Lunar Systems)
- Lunar-cycle battery (Venturi Space)
- ENDURE Am-241 RHU (Perpetual Atomics)
- Chang'e lunar RTG (CNNC / CIAE)
- Rosatom lunar RTG (Rosatom)
- BARC / LUPEX night survival (ISRO)

**First operational fission surface power on the Moon**

- eVinci Lunar Microreactor (Westinghouse)
- Fission Surface Power Reactor (Lockheed Martin)
- IX Fission Surface Power Reactor (Intuitive Machines)

**First sustained oxygen and metals from lunar regolith**

- Blue Alchemist ISRU (Blue Origin)
- Carbothermal Oxygen Reactor (Sierra Space)
- Molten Regolith Electrolysis (Lunar Resources)
- PERDEX / CISORT ISRU Hardware (Cislune)

**Water Ice: first published in-situ lunar surface water ice**

- Chang'e-7 (CNSA)
- VIPER on MK1 (Blue Origin)
- IM-4 volatiles (Intuitive Machines)

</details>

<details>
<summary>Building, living and staying in contact</summary>

**First demonstrated lunar landing-pad construction system**

- Project Olympus (ICON)
- Mason (Redwire)
- Lunatron / Brickbot (Astroport Space Technologies)
- REACT / LINA (AI SpaceFactory)
- Low-Energy Additive Construction (Voyager Lunar Systems)

**First pressurized habitat occupied on the lunar surface**

- NASA Moon Base (NASA)
- International Lunar Research Station (CNSA / Roscosmos)
- Multi-Purpose Habitat (Thales Alenia Space)
- LIFE Habitat (Sierra Space)
- Lunar Cruiser pressurized rover (JAXA)

**First operational lunar communications and navigation service**

- Lunar Surface Communication System (Modul8)
- Lunar Relay Satellites (Intuitive Machines)
- Lunar Pathfinder & Moonlight (European Space Agency)
- Parsec (Crescent Space Services)
- Lunar WiFi Access Point (Solstar Space Company)

</details>

## Caveats

This is a first version. A base built while signed out stays in that browser until you sign in or make a prediction, and clearing the browser's storage before then removes it. Some hardware does not have its own 3D model yet and is drawn with a stand-in, including every competitor in Night Shift. The models are illustrations of each team's hardware, not engineering drawings, and the plot is a generic patch of regolith rather than a real site.

Your base is a way to show what you think will happen. It has no effect on the odds, the leaderboard or any prize. Those come from the predictions themselves, which you can make here, in [Moon Base Zero](/moonbase) or on the [Touchdown page](/deprize/arb/1#deprize-forecast). Free predictions are open worldwide; adding ETH to your prediction is available in eligible jurisdictions.
