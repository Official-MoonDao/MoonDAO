---
title: "First Tracks: the race to drive the first commercial rover on the Moon"
description: "No company has driven a rover on the Moon. First Tracks is MoonDAO's prize for the first to do it. Meet the rovers, the missions and the rules."
date: 2026-11-25
author: MoonDAO
authorRole: Executive Branch
category: Mission Report
image: /assets/updates/first-tracks/hero.jpg
imageAlt: A small four-wheeled rover driving away from a gold lander on grey lunar ground, leaving a curved pair of wheel tracks behind it, with a crescent Earth above the horizon
imageCaption: "An illustration of the drive this prize is waiting for. No commercial rover has left tracks on the Moon yet."
tags:
  - deprize
  - first-tracks
  - moonbase
  - touchdown
featured: false
draft: false
---

Rovers have been driving on the Moon since 1970. Every one of them belonged to a government. Three of the five rovers in this story have already launched toward the Moon, in 2024 and 2025, and between them they have covered zero metres of lunar ground.

[First Tracks](/deprize/shared-first-tracks) is MoonDAO's DePrize for ending that streak. It asks one question: **which commercial rover will be first to leave its lander and drive at least 10 metres across the lunar surface?** There are six outcomes: Astrolab's FLIP, Voyager's CubeRover, Lunar Outpost's MAPP, ispace's Tenacious, Carnegie Mellon's Iris, and an Open Field for anyone else. All five rovers are parked in [Moon Base Zero](/moonbase?race=shared-first-tracks), MoonDAO's 3D model of a future lunar base, and you can predict the winner there for free today.

This post is a field guide. It covers the rules, the rovers and the people who built them, the landers they depend on, and how this prize fits with [Touchdown](/deprize/arb/1), Moon Base Zero and the rest of DePrize. Specifications and sources are in the appendix.

```stats
{
 "items": [
  {"value": "0 m", "label": "driven on the Moon by a commercial rover, ever"},
  {"value": "3 of 5", "label": "listed operators have already lost a rover with its lander"},
  {"value": "10 m", "label": "of ground to cover, with independent confirmation"},
  {"value": "2", "label": "landers with a listed rover aboard are due to launch in early 2027"}
 ]
}
```

<aside data-title="Key takeaways">

- **No commercial rover has driven on the Moon.** Iris never arrived. The first MAPP and Tenacious reached the surface inside landers that tipped or crashed. None of them turned a wheel on lunar ground.
- **The bar is low on purpose.** At CubeRover's standard speed of 4 cm/s, ten metres is about four minutes of driving. The hard parts come first: landing upright and getting off the lander.
- **Two landers decide the early race.** Griffin-1 carries FLIP and CubeRover to the south pole, with a launch targeted for January 2027. IM-3 carries MAPP to Reiner Gamma, targeted for March or April 2027.
- **A slot is an operator, not one rover.** Tenacious and Iris are gone, but ispace and Carnegie Mellon stay in the race with whatever they drive next. Open Field covers every commercial operator not on the list.
- **You can predict now.** First Tracks is open on Arbitrum as [prize 2](/deprize/arb/2), under rules version 1.0. Predictions are open worldwide. Adding ETH to a prediction is unavailable in restricted jurisdictions.

</aside>

```screens
{
 "figure": "The race",
 "title": "First Tracks in Moon Base Zero",
 "subtitle": "The five listed rovers are parked together, each labelled with its name. Pick one from the panel to predict it as the winner.",
 "items": [
  {"src": "/assets/updates/first-tracks/moonbase-first-tracks.jpg", "alt": "Moon Base Zero showing the First Tracks race: five small rovers labelled FLIP, Tenacious, MAPP, CubeRover and Iris-class on a patch of lunar ground, beside a panel listing the five competitors with Predict buttons", "url": "moondao.com/moonbase", "href": "/moonbase?race=shared-first-tracks"}
 ],
 "source": "Screenshot of a preview build, 25 November 2026."
}
```

## The question and the five tests

The prize pays attention to one event: a Qualifying Drive. Three definitions do most of the work.

- **Rover.** An uncrewed vehicle that moves across the surface on wheels, tracks or legs while staying in contact with the ground. Hopping and flying do not count. A crew-capable rover driven remotely with nobody aboard does.
- **Commercial.** The rover is operated by an organization that is not a national government or a government space agency. Companies and universities qualify. A rover operated by NASA, CNSA, ISRO, JAXA, ESA or Roscosmos does not, whoever built it.
- **Operator.** The organization that drives the rover on the surface. It is not the lander company, the launch provider or a payload customer, unless one of those also does the driving.

A drive qualifies only when it passes all five tests.

```graphic
{
 "figure": "Figure 1",
 "title": "What counts as a Qualifying Drive",
 "subtitle": "All five tests must be met. If any fails, the operator can try again with the same rover or a later one.",
 "src": "/assets/updates/first-tracks/qualifying-drive.jpg",
 "narrow": "/assets/updates/first-tracks/qualifying-drive-narrow.jpg",
 "alt": "Diagram of a lander on the lunar surface with a ramp, a dotted wheel track running 10 metres to a small rover, and an orbiter looking down. Five numbered tests: after open, egress, drive, distance evidence and independent confirmation.",
 "source": "First Tracks rules, version 1.0, effective 25 November 2026. Distances are to scale; the lander and rover are generic."
}
```

1. **After open.** The whole 10 metres is driven after the prize opens. A rover that is in transit or already on the surface when the prize opens is eligible, but distance driven before then does not count.
2. **Egress.** The whole rover has left the lander and rests on the surface. A ramp, a crane or a release mechanism are all fine. A rover still mounted on its lander has not egressed.
3. **Drive.** The rover covers at least 10 metres under its own power. Distance is the ground actually covered, added up across one or more drives. Wheels spinning in place do not count, and neither does being pushed, towed or carried.
4. **Distance evidence.** The 10 metres is shown by a traverse map, an image sequence, or a distance statement from the rover operator, the lander operator or a space agency involved in the mission.
5. **Independent confirmation.** At least one of: a public statement from a national space agency that flew or sponsored the rover, imagery of the rover off its lander from a camera the rover operator does not control, or surface telemetry received by a third party.

There is no deadline. The prize stays open until a Qualifying Drive is confirmed. If two rovers qualify, the earlier one wins, and two rovers from the same lander are scored separately.

A few cases show where the lines fall.

| Case | Result |
|---|---|
| FLIP and CubeRover both leave Griffin-1 | Each is scored on its own. The first to complete 10 metres wins |
| A rover leaves its lander, drives 4 metres and stops responding | Does not qualify. The operator's slot stays live |
| A rover drives 12 metres, and the only evidence is the operator's own video | Not yet. It still needs independent confirmation |
| A rover is lowered by a crane, then drives 10 metres | Qualifies |
| A government agency's rover drives 10 metres | Does not qualify, and the prize stays open |
| A hopper lands and hops 30 metres | Does not qualify. Hopping is not driving |

### Why only 10 metres

Ten metres is short. India's Pragyan covered about 100 metres in its two weeks on the surface. The Google Lunar XPRIZE asked for 500.

```chart
{
 "type": "bars",
 "figure": "Figure 2",
 "title": "Ten metres, in context",
 "subtitle": "The First Tracks distance beside the total drives of two small government rovers and the distance the Google Lunar XPRIZE required.",
 "unit": " m",
 "rows": [
  {"label": "First Tracks", "color": "#fbbf24"},
  {"label": "Pragyan", "color": "#60a5fa"},
  {"label": "Yutu", "color": "#60a5fa"},
  {"label": "Lunar XPRIZE", "color": "#94a3b8"}
 ],
 "panels": [
  {"name": "Distance", "values": [10, 101, 115, 500]}
 ],
 "source": "Pragyan (ISRO, 2023) and Yutu (CNSA, 2013) totals are rounded. The Lunar XPRIZE distance is the prize requirement, which no team met."
}
```

The distance is set low because distance is not the hard part. CubeRover's standard drive speed is 4 centimetres a second, which makes 10 metres a little over four minutes of wheel time. What has stopped every commercial rover so far happened earlier: the lander did not arrive, or did not arrive upright, or the rover could not get out. Ten metres is long enough to prove a rover is off the lander, mobile and under control, and short enough that the prize measures the capability, not the endurance.

## Nobody has done this yet

Nine wheeled vehicles have driven on the Moon. Three were Apollo rovers with astronauts at the controls. Six were robotic rovers from the Soviet Union, China and India. Every one flew on a government mission. So did Japan's two small LEV robots, which hopped and rolled beside the SLIM lander in 2024.

```chart
{
 "type": "bars",
 "figure": "Figure 3",
 "title": "Every kilometre driven on the Moon",
 "subtitle": "Total distance by vehicle. The three Apollo rovers were driven by astronauts. The rest were driven from Earth.",
 "unit": " km",
 "rows": [
  {"label": "Lunokhod 2", "color": "#60a5fa"},
  {"label": "Apollo 17", "color": "#60a5fa"},
  {"label": "Apollo 15", "color": "#60a5fa"},
  {"label": "Apollo 16", "color": "#60a5fa"},
  {"label": "Lunokhod 1", "color": "#60a5fa"},
  {"label": "Yutu-2", "color": "#60a5fa"},
  {"label": "Yutu", "color": "#60a5fa"},
  {"label": "Pragyan", "color": "#60a5fa"},
  {"label": "Commercial", "color": "#fbbf24"}
 ],
 "panels": [
  {"name": "Distance driven", "values": [39, 35.7, 27.8, 26.9, 10.5, 1.6, 0.11, 0.1, 0]}
 ],
 "source": "Published mission totals, rounded. The Yutu-2 figure is approximate. China's Jinchan mini rover (2024) also drove, but its distance has not been published."
}
```

The idea of a private rover on the Moon is older than most of the companies trying it. The Google Lunar XPRIZE opened in 2007 with $20 million for the first privately funded team to land and travel 500 metres. It closed in 2018 with no winner. Two of the organizations in this field come straight out of it. Astrobotic was founded in 2007 by Carnegie Mellon's Red Whittaker to win it. ispace began in 2010 as the company behind Team Hakuto and its Sorato micro rover.

Since then, commercial rovers have reached the launch pad three times and the lunar surface twice.

- **Iris, January 2024.** Carnegie Mellon's 2 kg rover launched on Astrobotic's Peregrine. A valve failure caused a propellant leak hours after launch and the lander never reached the Moon. Students powered Iris on in space and turned its wheels before Peregrine re-entered on 18 January.
- **MAPP, March 2025.** Lunar Outpost's rover rode Intuitive Machines' IM-2 lander to Mons Mouton, near the south pole. The lander came to rest on its side on 6 March with the rover's garage wedged underneath. MAPP was alive, but had no way out.
- **Tenacious, June 2025.** ispace's rover was aboard Hakuto-R Mission 2, which hit Mare Frigoris hard on 5 June after trouble with its laser rangefinder.

No lunar landing mission launched in 2026, so the count has not moved since.

```graphic
{
 "figure": "Figure 4",
 "title": "Where rovers have driven, and where the next ones are going",
 "subtitle": "White dots are government rovers that drove. Red crosses mark commercial rovers lost with their landers. Blue rings are the two planned landings that carry a listed rover.",
 "src": "/assets/updates/first-tracks/moon-map.jpg",
 "narrow": "/assets/updates/first-tracks/moon-map-narrow.jpg",
 "alt": "Map of the near side of the Moon. Government rover sites are marked for Lunokhod 1 and 2, Apollo 15, 16 and 17, Yutu and Pragyan. Red crosses mark Tenacious in Mare Frigoris and the first MAPP at Mons Mouton. Blue rings mark IM-3's target at Reiner Gamma and Griffin-1's target at Mons Mouton. A large figure reads 0 metres driven on the Moon by a commercial rover.",
 "source": "Orthographic projection of published site coordinates. The dark maria are schematic. Planned sites are targets and may change."
}
```

## The field

Five operators are named on the roster. A sixth outcome, Open Field, covers any commercial operator that is not.

Competitor listings are editorial and based solely on public sources. No listed organization has been contacted, has consented, or is affiliated with this prize.

```graphic
{
 "figure": "Figure 5",
 "title": "One golf cart and four carry-ons",
 "subtitle": "The five listed rovers beside a person, at the same scale. FLIP is about 480 kg. The other four total about 22 kg.",
 "src": "/assets/updates/first-tracks/rovers-scale.jpg",
 "narrow": "/assets/updates/first-tracks/rovers-scale-narrow.jpg",
 "alt": "Side view of five rovers drawn to scale beside a 1.7 metre person. FLIP is 2.13 metres long. Tenacious, MAPP, CubeRover and Iris are each well under a metre long.",
 "source": "Lengths are from each operator's published figures. Heights and shapes are illustrative. CubeRover's dimensions are not published, so it is drawn shoebox-sized, as the operator describes it."
}
```

### Astrolab FLIP: the heavyweight

```stats
{
 "items": [
  {"value": "~480 kg", "label": "mass at launch"},
  {"value": "2.13 m", "label": "long"},
  {"value": "20 km/h", "label": "top speed, per Venturi Space"},
  {"value": "30 kg", "label": "payload capacity"}
 ]
}
```

**Who.** Venturi Astrolab, of Hawthorne, California. Jaret Matthews, a former engineer at NASA's Jet Propulsion Laboratory and at SpaceX, founded it in January 2020. Astrolab is best known for FLEX, a crew-capable rover, and for its place in NASA's Lunar Terrain Vehicle programme. In May 2026 NASA awarded it a $219 million task order for a vehicle due on the Moon by 2028.

**The rover.** FLIP stands for FLEX Lunar Innovation Platform. It weighs about 480 kg at launch, is 2.13 metres long, and carries up to 30 kg of payload on four skid-steered wheels. Its partner Venturi Space supplies flexible wheels made in Switzerland and batteries built in Monaco, and quotes a top speed of 20 km/h. It is driven from Earth with some autonomy, and it is designed to survive the lunar night, which the small rovers in this field are not.

**How it got here.** FLIP exists because another rover lost its ride. NASA cancelled its VIPER rover in July 2024, which left Astrobotic's Griffin-1 lander without its main cargo. Astrolab signed on that October and built FLIP to fit the space and mass that had been set aside for VIPER. It went from a paper design to a flight-qualified rover in about 18 months.

**The ride.** Griffin-1, to Mons Mouton near the south pole. Getting off is unusual. Griffin's ramps are steep, so FLIP lowers itself down them on fabric tethers wound around its rear wheels, in effect rappelling to the surface. It carries about 20 payloads, including NASA instruments, a camera developed with Interlune and a Hewlett Packard Enterprise computer.

**What to weigh.** FLIP flies on the first lander scheduled to launch, and 10 metres is nothing to a machine built to drive kilometres. Against that, it is a new rover on a lander that has never landed, with a descent down the ramps that no rover has made on the Moon.

### Voyager CubeRover: the shoebox

```stats
{
 "items": [
  {"value": "~5 kg", "label": "with its deployment system"},
  {"value": "4 cm/s", "label": "standard drive speed"},
  {"value": "2 kg", "label": "payload capacity"},
  {"value": "April 2026", "label": "integrated on Griffin-1"}
 ]
}
```

**Who.** Voyager Lunar Systems, of Pittsburgh. Until July 2026 this was Astrobotic, the lander company that Red Whittaker founded for the Lunar XPRIZE. Voyager Technologies completed its acquisition on 13 July 2026, and John Thornton still leads the business. It builds both the lander and this rover.

**The rover.** CubeRover is a product line sized like CubeSats. The unit flying is the smallest, the 2U class, which Astrobotic describes as shoebox-sized. Its payload guide lists about 5 kg for the rover with its deployment system, 2 kg of payload, four skid-steered wheels, a standard drive speed of 4 cm/s and a maximum of 10 cm/s. Standard units are not built to survive the lunar night.

**The mission.** CubeRover-1 was integrated onto Griffin-1 on 13 April 2026. Its mission, called BEACON and flown with the Canadian company Mission Control, tests long-range communications that do not depend on the lander and gathers thermal data for future rovers. Astrobotic says it will travel several kilometres.

**What to weigh.** It shares a lander with FLIP, so it shares FLIP's place in the queue and FLIP's landing risk. The two are scored separately, and whichever completes 10 metres first wins. We have not found a published order of deployment. The company that built the lander also built this rover, which should count for something when it comes to getting off.

### Lunar Outpost MAPP: the second try

```stats
{
 "items": [
  {"value": "10 kg", "label": "rover mass"},
  {"value": "45 cm", "label": "long"},
  {"value": "10 cm/s", "label": "top speed"},
  {"value": "~500 m", "label": "planned drive at Reiner Gamma"}
 ]
}
```

**Who.** Lunar Outpost, of Golden, Colorado, founded in 2017 by Justin Cyrus, Julian Cyrus, AJ Gemer and Forrest Meyen. It runs its rovers from a mission control room in Arvada. Like Astrolab, it holds a NASA Lunar Terrain Vehicle award, worth $220 million, announced in May 2026.

**The rover.** MAPP is the Mobile Autonomous Prospecting Platform. The unit flying next weighs 10 kg, measures 45 by 38 by 40 cm, and has a top speed of 10 cm/s. Lunar Outpost drives it in real time over a radio link to the lander.

**The history.** This is the only operator here whose rover has reached the surface of the Moon. The first MAPP was aboard IM-2 in March 2025 and was working when the lander came to rest on its side. Lunar Outpost describes it as the first commercial rover on another planetary body. Under these rules it never egressed, so it never started.

**The mission.** The second MAPP flies on Intuitive Machines' IM-3 to Reiner Gamma, a bright swirl on the near side where the Moon's crust is unusually magnetic. It carries a magnetometer from Johns Hopkins APL and a microscope from Canadensys for NASA's Lunar Vertex investigation. The plan is to drive about 500 metres over one lunar day, roughly 13 Earth days.

**What to weigh.** Lunar Outpost has built and flown this rover before, and the science plan needs fifty times the prize distance. But its lander is second in line, and both earlier Nova-C landers tipped over. Intuitive Machines has added a Doppler lidar and two backup laser rangefinders for IM-3.

### ispace Tenacious: waiting for a new lander

```stats
{
 "items": [
  {"value": "~5 kg", "label": "rover mass"},
  {"value": "54 cm", "label": "long"},
  {"value": "1 kg", "label": "payload capacity"},
  {"value": "2028", "label": "next ispace rover, on Mission 3"}
 ]
}
```

**Who.** ispace, of Tokyo, founded in 2010 by Takeshi Hakamada. Its Luxembourg subsidiary, ispace-EUROPE, built Tenacious with co-funding from the Luxembourg Space Agency.

**The rover.** Tenacious weighed about 5 kg and measured 54 by 31.5 by 26 cm, with a carbon-fibre frame, four wheels, a forward camera and a small shovel. The shovel was there to collect regolith, under a contract to sell the sample to NASA.

**The history.** ispace has attempted two landings. Hakuto-R Mission 1 crashed in April 2023. Mission 2, with Tenacious aboard, was lost in June 2025.

**What comes next.** ispace plans a micro rover on Mission 3, which uses a new and larger lander called ULTRA. The lander's preliminary design review finished on 13 November 2026 and launch is planned for 2028. Under the slot rule, that rover counts for ispace.

**What to weigh.** ispace has more experience flying to the Moon than most of this field, and none yet of landing softly. Its next attempt is at least a year behind the two 2027 missions, so it most likely needs both of them to fall short.

### Carnegie Mellon Iris: the students

```stats
{
 "items": [
  {"value": "2 kg", "label": "rover mass"},
  {"value": "25 cm", "label": "chassis length"},
  {"value": "~300", "label": "students who built it"},
  {"value": "2029", "label": "next Carnegie Mellon rover, MoonRanger"}
 ]
}
```

**Who.** Carnegie Mellon University, in Pittsburgh. About 300 students built Iris. Universities count as commercial under these rules, because the test is whether a government operates the rover.

**The rover.** Iris weighed 2 kg. Its chassis was 25 by 17.5 by 10.5 cm, made of carbon fibre, on four 18 cm wheels shaped like bottle caps. It ran on a battery and was designed to last about 72 hours.

**The history.** Iris launched on Peregrine in January 2024 and was lost with it. The team operated it in space on the way.

**What comes next.** There is no announced flight for another rover of the Iris class. Carnegie Mellon's next rover is MoonRanger, a suitcase-sized autonomous rover that will look for signs of water. It is due to be delivered to Firefly in July 2027 and to fly on a Blue Ghost lander to the south pole in 2029. Which slot MoonRanger would count for depends on who drives it, and we are not ruling on that here.

**What to weigh.** This is the longest wait in the field. If MoonRanger does count, it rides the only commercial lander design that has landed upright.

### Open Field

Open Field wins if a commercial operator not on the roster makes the first Qualifying Drive. Candidates we know of include Dymon's Yaoki, a Japanese micro rover that flew on IM-2 and was not deployed, and a rover that Honeybee Robotics is building for a later Firefly mission. A rover from MDP-262, the MoonDAO-funded FUTURA rover project, could win only through this slot.

Government rovers are flying on some of the same landers and cannot win. NASA's three CADRE rovers share IM-3 with MAPP. The UAE's Rashid 2 flies on Firefly's Blue Ghost Mission 2 in 2027. NASA's VIPER is now booked on a Blue Origin lander. If one of them drives first, the prize stays open.

## The rides

> A rover cannot win unless its lander does.

Every rover in this race is cargo until its lander is down, upright and working. That makes the landers the first thing to study.

| Rover | Lander | Landing site | Target | Lander's record |
|---|---|---|---|---|
| FLIP and CubeRover | Griffin-1 (Voyager Lunar Systems) | Mons Mouton, near the south pole | Launch January 2027 | First landing attempt. Peregrine never reached the Moon |
| MAPP | Nova-C on IM-3 (Intuitive Machines) | Reiner Gamma | Launch March or April 2027 | Two landings, both tipped over |
| ispace micro rover | ULTRA on Mission 3 (ispace) | Not announced | 2028 | New lander. Two Hakuto-R landers were lost |
| MoonRanger | Blue Ghost (Firefly) | South pole | 2029 | One landing, upright |

**Griffin-1** is a large lander, about 4.5 metres across, built to deliver more than 455 kg to the surface. It launches on a SpaceX Falcon Heavy. It finished acceptance testing at JPL in late September 2026. Voyager says it will launch in January 2027. NASA said on 7 November that the launch would be no earlier than January, with engine testing still under way.

**IM-3** is the third flight of Intuitive Machines' Nova-C, launching on a Falcon 9. The company's November 2026 results put the launch in March or April 2027, followed by about a week in transit.

The record these landers are flying into is not kind.

```chart
{
 "type": "stack",
 "figure": "Figure 6",
 "title": "How lunar landing attempts have ended",
 "subtitle": "Every landing attempt from 2013 to 2025, split by who flew it. One commercial lander has touched down upright.",
 "segments": [
  {"name": "Landed upright", "color": "#34d399"},
  {"name": "Tipped over", "color": "#fbbf24"},
  {"name": "Crashed", "color": "#f87171"},
  {"name": "Never arrived", "color": "#94a3b8"}
 ],
 "rows": [
  {"label": "Commercial, 7 attempts", "values": [1, 2, 3, 1]},
  {"label": "Government, 8 attempts", "values": [5, 1, 2, 0]}
 ],
 "source": "Commercial: Beresheet, Hakuto-R Mission 1, Peregrine, IM-1, Blue Ghost Mission 1, IM-2, Hakuto-R Mission 2. Government: Chang'e 3, 4, 5 and 6, Chandrayaan-2 and 3, Luna 25, SLIM."
}
```

One in seven is the whole commercial record for landing upright, and that one lander, Firefly's Blue Ghost in March 2025, carried no rover. A commercial rover has reached the surface in working order only inside a lander lying on its side.

```timeline
{
 "figure": "Figure 7",
 "title": "Three losses, then four more chances",
 "subtitle": "Flights that carried a listed operator's rover, and the ones now planned. Solid markers are done, the glowing marker is today, and hollow markers are ahead.",
 "items": [
  {"date": "Jan 2024", "title": "Iris launches on Peregrine", "body": "A propellant leak ends the mission in space. The lander never reaches the Moon."},
  {"date": "Mar 2025", "title": "The first MAPP reaches the surface on IM-2", "body": "The lander comes to rest on its side near Mons Mouton. The rover cannot get out."},
  {"date": "Jun 2025", "title": "Tenacious is lost with Hakuto-R Mission 2", "body": "The lander hits Mare Frigoris hard after a rangefinder problem."},
  {"date": "Nov 2026", "title": "First Tracks opens on Arbitrum", "body": "Prize 2 opens on 25 November. Predictions are open worldwide. Adding ETH to a prediction is unavailable in restricted jurisdictions.", "status": "now"},
  {"date": "Jan 2027", "title": "Griffin-1 with FLIP and CubeRover", "body": "Target launch on a Falcon Heavy, bound for Mons Mouton.", "status": "next"},
  {"date": "Mar–Apr 2027", "title": "IM-3 with MAPP", "body": "Target launch on a Falcon 9, bound for Reiner Gamma.", "status": "next"},
  {"date": "2028", "title": "ispace Mission 3", "body": "A micro rover on the new ULTRA lander.", "status": "next"},
  {"date": "2029", "title": "MoonRanger on Blue Ghost", "body": "Carnegie Mellon's next rover, bound for the south pole.", "status": "next"}
 ],
 "source": "Operator and agency announcements as of 25 November 2026. Future dates are targets."
}
```

## How to think about your pick

We are not publishing odds of our own. When the ETH market opens, every outcome starts level at one in six, about 16.7%, and the first forecasters to disagree get to move it. These are the questions we would start with.

1. **Does the lander land?** This is most of the bet. A pick for FLIP or CubeRover is first a pick that Griffin-1 lands upright on its first attempt. A pick for MAPP is first a pick that Nova-C stays on its feet at the third try.
2. **Who gets there first?** Griffin-1 is scheduled a couple of months ahead of IM-3. If it lands and either rover drives 10 metres, the race is probably over before IM-3 leaves the pad. If Griffin-1 slips or fails, MAPP moves to the front.
3. **Does the schedule hold?** Launch dates for lunar landers move, and usually later. A delay of a few months on one side reverses the order.
4. **Can the rover get off?** Egress is its own test. MAPP has already shown that a healthy rover inside a tipped lander goes nowhere. FLIP's tethered descent and CubeRover's deployment are both first attempts.
5. **Which rover on Griffin-1?** If the lander works, two listed rovers are on the surface together. Which drives 10 metres first depends on the deployment plan and how long each team spends checking out its rover before moving.
6. **How long is the game?** If both 2027 missions fall short, the prize runs on to ispace in 2028, to Carnegie Mellon in 2029, and to anyone in the Open Field who gets there sooner. There is no deadline.

## Where First Tracks sits: the ladder and Touchdown

First Tracks is the second step on what we call the capability ladder: four prizes, each for a capability a lunar base needs, in the order they have to be proven.

```graphic
{
 "figure": "Figure 8",
 "title": "Four prizes, in the order a base needs them",
 "subtitle": "Each rung is its own prize with its own competitors. A commercial lander has landed upright once. No commercial rover has driven.",
 "src": "/assets/updates/first-tracks/capability-ladder.jpg",
 "narrow": "/assets/updates/first-tracks/capability-ladder-narrow.jpg",
 "alt": "Four rising steps. Rung 0, Touchdown: land upright and keep working, live on Arbitrum. Rung 1, First Tracks: leave the lander and drive 10 metres, next, free picks open. Rung 2, Water Ice: detect water ice in place on the surface, planned. Rung 3, Night Shift: survive the lunar night, planned.",
 "source": "MoonDAO capability ladder. Water Ice and Night Shift are planned and their rules are not final."
}
```

The first step is [Touchdown](/deprize/arb/1), which has been live on Arbitrum since late October. It asks which organization makes the next Qualifying Landing on the Moon: a controlled descent, in a stable planned orientation, followed by 24 hours of surface data, or the full planned mission if that is shorter. Seven outcomes share one market.

```chart
{
 "type": "bars",
 "figure": "Figure 9",
 "title": "The Touchdown market today",
 "subtitle": "Chance of making the next Qualifying Landing, set by ETH bets. Gold bars are the landers that carry a First Tracks rover.",
 "unit": "%",
 "rows": [
  {"label": "Griffin-1", "color": "#fbbf24"},
  {"label": "Chang'e-7", "color": "#94a3b8"},
  {"label": "Nova-C IM-3", "color": "#fbbf24"},
  {"label": "Blue Moon", "color": "#94a3b8"},
  {"label": "Blue Ghost", "color": "#94a3b8"},
  {"label": "ispace", "color": "#94a3b8"},
  {"label": "Starship HLS", "color": "#94a3b8"}
 ],
 "panels": [
  {"name": "Chance to land next", "values": [22.0, 21.2, 18.4, 12.9, 8.5, 8.5, 8.5]}
 ],
 "source": "Touchdown market on Arbitrum, read 25 November 2026. Operators, top to bottom: Voyager Lunar Systems (formerly Astrobotic), CNSA, Intuitive Machines, Blue Origin, Firefly, ispace, SpaceX."
}
```

The two prizes share hardware but ask different questions. Touchdown is about which lander is next. First Tracks is about what happens after a lander is down. If Griffin-1 lands upright and returns a day of data, it wins Touchdown, and FLIP and CubeRover are then on the surface with a clear run at First Tracks. If it does not, both prizes move on to the next mission.

Earlier this month four AI models researched Touchdown and placed real bets on it. Their notes are a good primer on the same landers this race depends on: [What four AI forecasters learned about the next Moon landing](/updates/ai-forecasters-first-bets-on-touchdown).

```screens
{
 "figure": "The prizes",
 "title": "Touchdown and First Tracks on the DePrize page",
 "subtitle": "Touchdown is live, with odds set by ETH bets. First Tracks sits below it as the next prize.",
 "items": [
  {"src": "/assets/updates/first-tracks/deprize-index.jpg", "alt": "The DePrize page. A Touchdown card lists five landers with their chances and a price chart, with 826 dollars of prize available. Below it, a First Tracks card lists FLIP, CubeRover and MAPP.", "url": "moondao.com/deprize", "href": "/deprize"}
 ],
 "source": "Screenshot of a preview build, 25 November 2026."
}
```

## How a DePrize works

A DePrize is a prize and a prediction market joined together. The market tells you who people think will win. The betting is what funds the prize.

```graphic
{
 "figure": "Figure 10",
 "title": "Three ways in, one resolution",
 "subtitle": "Free predictions feed the DAO forecast. ETH bets set the odds, and about 5% of each one goes into the prize.",
 "src": "/assets/updates/first-tracks/how-a-deprize-works.jpg",
 "narrow": "/assets/updates/first-tracks/how-a-deprize-works-narrow.jpg",
 "alt": "Diagram with three columns. Predict free: pick a winner, which feeds the DAO forecast and the leaderboard. Back it with ETH: buy shares in a live market where winning shares pay 1 ETH. The prize: about 5% of every bet goes to the prize purse, which buys a community payload on the winner's next flight. All three pass through the same resolution: evidence checked against the rules, a Senate vote, a 72-hour challenge and a result reported on-chain.",
 "source": "DePrize how-it-works page and First Tracks rules."
}
```

- **Predict for free.** Anyone, anywhere, can pick a winner. It costs nothing. Citizens' picks are weighted by voting power and combined into the DAO forecast, and every forecaster is scored on the leaderboard when the race ends.
- **Back your pick with ETH.** The price of a share is the current chance. At 25%, a share costs 0.25 ETH and pays 1 ETH if that outcome wins. You can cash out while the market is open. This part is available in eligible jurisdictions only.
- **Every bet grows the prize.** About 5% of each bet goes straight into the prize, alongside anything patrons add directly. Bettors do not share the prize. It belongs to the winner.
- **Resolution follows the rules, in public.** When a drive may have qualified, MoonDAO publishes a checklist against the five tests. A review committee examines the evidence, the Senate votes on the checklist, and anyone can challenge the result for at least 72 hours before it is reported on-chain.
- **If nobody wins.** If a prize is cancelled or ends with no winner, bets are refundable.
- **Who cannot bet.** Competitors and insiders.

The prize itself is not a cheque. It is a community payload purchase on the winner's next flight, so the money goes back into the hardware the prize was meant to encourage. What it buys depends on how large the purse has grown: a nameplate or plaque under $5,000, a data capsule from $5,000, and a larger payload slot from $25,000. Those brackets are provisional. If the winner does not take it up, they can name a nonprofit to receive it. If there is no response, the purse rolls into a future prize.

For the full walkthrough, see [how DePrize works](/deprize/how-it-works).

## Moon Base Zero and your own base

[Moon Base Zero](/moonbase) is where these races become something you can look at. It is a 3D model of a future lunar base in which every piece of hardware stands in the race it is trying to win: landers on their pads, reactors, habitats and the five First Tracks rovers lined up on a patch of regolith. Open a race and its competitors appear in a side panel, each with a Predict button. A slider along the bottom runs the base forward from 2026 to 2050. Hardware taller than 2.5 metres is drawn at true scale, and smaller pieces such as these rovers are enlarged so you can see them. There is a [guided tour](/moonbase/tour) if you want one.

[My Moonbase](/moonbase/mine) turns your predictions into a base of your own. It gives you an empty plot and one rule: **you can only build with hardware you have predicted to win.** Pick a rover in First Tracks and that rover becomes yours to place. Pick a lander in Touchdown and you have somewhere for it to have come from.

```screens
{
 "figure": "The builder",
 "title": "A base built from one pick in every race",
 "subtitle": "The panel on the left lists the hardware you have unlocked, race by race. The toolbar switches between selecting, drawing roads, placing scenery and erasing.",
 "items": [
  {"src": "/assets/updates/my-moonbase/builder.jpg", "alt": "My Moonbase showing an example base: a Starship lander on a round pad, a domed habitat, a reactor with tall radiator panels and smaller hardware joined by roads, with a panel on the left listing the predicted hardware and a toolbar along the bottom", "url": "moondao.com/moonbase/mine", "href": "/moonbase/mine"}
 ],
 "source": "Screenshot of a preview build, 19 November 2026. The base shown is an example."
}
```

- **Eleven races, 47 pieces of hardware.** Each race you predict unlocks the piece you picked. In First Tracks that is FLIP, CubeRover, MAPP, Tenacious or an Iris-class rover.
- **A 240 metre plot on a 6 metre grid.** A rover takes one cell. Two clicks draw a road, and eleven kinds of scenery, from street lights to solar arrays, can be placed as often as you like.
- **Changing your mind is allowed.** Switch your pick and the old hardware leaves, but its lot stays marked on the ground until you decide what to do with it.
- **It is free.** Predicting and building cost nothing. Your predictions follow your wallet, and the layout is saved in your browser.

Two people who disagree about this race end up with different bases. One has a rover the size of a golf cart parked by a Griffin lander. The other has a 10 kg prospector next to a Nova-C. The full guide is in [My Moonbase: build a lunar base from your predictions](/updates/my-moonbase).

## Where things stand

- **Free predictions are open.** You can predict the First Tracks winner today from [Moon Base Zero](/moonbase?race=shared-first-tracks) or the [prize page](/deprize/shared-first-tracks).
- **The market is open.** MoonDAO's executive multisig registered and opened First Tracks on Arbitrum on 25 November 2026 as [prize 2](/deprize/arb/2). Predictions are open worldwide. Adding ETH to a prediction is unavailable in restricted jurisdictions.
- **The rules are version 1.0 and frozen.** They took effect when the prize opened. The question, the definitions, the five tests and the tie-break are frozen. Only clarifications that cannot change an outcome are allowed.
- **No mid-race opening.** The rules bar opening the market while a listed operator's rover is on the surface and able to drive, or within a week of a landing that carries one.

## Make your own call

You now know what we know. If you think the first lander in line gets it done, or that a rover with a flight behind it is the safer pick, or that this takes until 2029, you can say so.

```cta
{
 "eyebrow": "First Tracks DePrize · free predictions open",
 "title": "Which rover leaves the first commercial tracks on the Moon?",
 "body": "Pick the rover you think drives 10 metres first. Predicting is free, and Citizens' predictions are weighted by voting power and combine into the DAO forecast.",
 "points": [
  "Open the race in Moon Base Zero and tap Predict beside a rover. It costs nothing.",
  "Your pick unlocks that rover for your own base in My Moonbase.",
  "When the ETH market opens, back your pick where eligible. About 5% of every bet grows the prize for the winning team."
 ],
 "actions": [
  {"label": "Predict on First Tracks", "href": "/moonbase?race=shared-first-tracks", "primary": true},
  {"label": "Read the prize page", "href": "/deprize/shared-first-tracks"},
  {"label": "Build My Moonbase", "href": "/moonbase/mine"}
 ],
 "image": {"src": "/assets/updates/first-tracks/predict-panel.jpg", "alt": "The First Tracks panel in Moon Base Zero, listing FLIP, CubeRover, MAPP, Tenacious and Iris-class with a Predict button beside each, next to the five rovers on the lunar surface"},
 "note": "Not financial advice. Adding ETH to a prediction is available in eligible jurisdictions."
}
```

## Appendix: specifications and sources

### The rovers, side by side

| | FLIP | CubeRover | MAPP | Tenacious | Iris |
|---|---|---|---|---|---|
| Operator | Venturi Astrolab | Voyager Lunar Systems | Lunar Outpost | ispace | Carnegie Mellon University |
| Based in | Hawthorne, California | Pittsburgh, Pennsylvania | Golden, Colorado | Tokyo and Luxembourg | Pittsburgh, Pennsylvania |
| Mass | About 480 kg | About 5 kg with its deployment system | 10 kg | About 5 kg | 2 kg |
| Size | 2.13 m long | Shoebox-sized, not published | 45 × 38 × 40 cm | 54 × 31.5 × 26 cm | 25 × 17.5 × 10.5 cm chassis, 18 cm wheels |
| Wheels | 4, skid steer | 4, skid steer | 4 | 4 | 4 |
| Top speed | 20 km/h | 10 cm/s, 4 cm/s standard | 10 cm/s | Not published | Not published |
| Payload | Up to 30 kg | 2 kg | Magnetometer and microscope | Up to 1 kg | Not published |
| Status | Manifested on Griffin-1 | Integrated on Griffin-1, April 2026 | Second unit flies on IM-3 | Lost June 2025. Next rover planned for Mission 3 | Lost January 2024. No Iris-class flight announced |

### The rules in brief

- **Question.** Which commercial rover will be first to leave its lander and drive at least 10 metres across the lunar surface?
- **Outcomes.** Astrolab FLIP, Voyager CubeRover, Lunar Outpost MAPP, ispace Tenacious, Carnegie Mellon Iris, Open Field.
- **Slots.** A named slot is the rover operator. Any rover that operator drives counts, including a later rover if the named one is lost. A change of ownership does not split or move a slot.
- **Ties.** The earlier qualifying time wins. If the evidence cannot put two drives in order, the earlier egress wins.
- **Deadline.** None.
- **Evidence window.** If the checklist cannot be completed from public sources within 14 days of a claimed drive, the drive is scored as not yet qualified, the market stays open, and the claim is reviewed again when more is published.
- **Prize.** A community payload purchase. The winner is the rover operator.

The full text is [DEPRIZE_FIRST_TRACKS.md](https://github.com/Official-MoonDao/MoonDAO/blob/main/docs/DEPRIZE_FIRST_TRACKS.md) in the MoonDAO repository.

### Sources

<details>
<summary>Rovers and operators</summary>

- **FLIP.** Astrolab's [FLIP rover](https://www.astrolab.space/flip-rover) and [Mission 1](https://www.astrolab.space/mission-1) pages; [Venturi Space](https://www.venturi.space/) on the wheels, batteries and top speed; conference abstracts from LPSC 2026 and LEAG 2025; reporting by The Register, Space.com and MIT Technology Review, 20 October 2026.
- **CubeRover.** Astrobotic's CubeRover Payload User's Guide, version 2.0; Astrobotic, [CubeRover integrates with Griffin-1](https://www.astrobotic.com/cuberover-integrates-with-griffin-1/), April 2026.
- **MAPP.** [Lunar Outpost](https://www.lunaroutpost.com/), Lunar Voyage 1 update, 7 March 2025; Johns Hopkins APL on Lunar Vertex; NASASpaceflight, 9 December 2025.
- **Tenacious.** [ispace](https://ispace-inc.com/) mission pages and announcements for Hakuto-R Mission 2, Mission 3 and the ULTRA lander.
- **Iris and MoonRanger.** Carnegie Mellon University announcements.

</details>

<details>
<summary>Missions and history</summary>

- **Griffin-1 and IM-3.** Voyager announcements of 12 and 24 November 2026; NASA statement of 7 November 2026; Intuitive Machines' third-quarter results, 12 November 2026; NASA's [CLPS deliveries](https://science.nasa.gov/lunar-science/clps-deliveries/) page.
- **Distances driven.** Wikipedia, [List of rovers on extraterrestrial bodies](https://en.wikipedia.org/wiki/List_of_rovers_on_extraterrestrial_bodies), checked against agency figures.
- **Google Lunar XPRIZE.** [XPRIZE](https://www.xprize.org/prizes/google-lunar).
- **Touchdown odds.** Read from the Touchdown market contract on Arbitrum on 25 November 2026.

</details>

## Caveats

Competitor listings are editorial and based solely on public sources. No listed organization has been contacted, has consented, or is affiliated with this prize.

The rules described here are version 1.0, in force since the Arbitrum market opened on 25 November 2026, and the appendix summary is not a substitute for the full text. Launch dates, landing sites and rover specifications come from public statements as of 25 November 2026 and will change. Where an operator has not published a figure, we have said so and have not guessed. Nothing here is advice.

You can watch the race in [Moon Base Zero](/moonbase?race=shared-first-tracks), read the criteria on the [prize page](/deprize/shared-first-tracks), and follow the first rung on the [Touchdown page](/deprize/arb/1). Free predictions and voting-power-weighted Citizen forecasts are open worldwide; adding ETH to your prediction is available in eligible jurisdictions.
