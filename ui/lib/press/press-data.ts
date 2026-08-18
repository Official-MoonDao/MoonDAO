// Curated press data. MoonDAO's newsletter host (Kit) exposes no feed and its public index
// only ever returns the 10 most recent posts, so this list is maintained by hand.

export type PressDate = string // 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'

export type PressRelease = {
  title: string
  date: PressDate
  url: string
  source: string
  summary: string
}

export type CoverageItem = {
  outlet: string
  title: string
  date: PressDate
  url: string
  logo?: string
}

export type MediaAppearance = {
  program: string
  title: string
  url: string
  date?: PressDate
}

export type Spokesperson = {
  name: string
  role: string
  bio: string
  image?: string
}

export type BrandAsset = {
  name: string
  description: string
  href: string
  external?: boolean
}

export type Fact = {
  label: string
  value: string
}

export const PRESS_CONTACT_EMAIL = 'info@moondao.com'
export const CAMPAIGN_PRESS_CONTACT_EMAIL = 'spaceteam@brodeur.com'

export const PRESS_BOILERPLATE = `MoonDAO is the Internet's Space Program, a decentralized autonomous organization accelerating the development of a self-sustaining, self-governing settlement on the Moon. Founded in 2021, MoonDAO raised more than $8 million in ETH from over 2,600 people in a single month and used part of that treasury to buy two seats aboard Blue Origin's New Shepard rocket, becoming the first organization to crowdfund human spaceflight. MoonDAO has since flown two astronauts to space, delivered its Constitution of the Moon to the lunar surface, and funds open space projects through community governance with the $MOONEY token.`

export const PRESS_FACTS: Fact[] = [
  { label: 'Founded', value: '2021' },
  { label: 'Raised in first month', value: '$8M+ in ETH' },
  { label: 'Contributors to the raise', value: '2,600+' },
  { label: 'Astronauts flown', value: '2' },
  { label: 'Legal structure', value: 'Marshall Islands DAO LLC' },
  { label: 'Governance token', value: '$MOONEY' },
]

// Major announcements only. The full newsletter archive lives at news.moondao.com.
export const PRESS_RELEASES: PressRelease[] = [
  {
    title: 'Send Frank White to Space',
    date: '2026-03-18',
    url: 'https://news.moondao.com/posts/send-frank-white-to-space',
    source: 'MoonDAO Newsletter',
    summary:
      'MoonDAO opens a community fundraise to fly Frank White, author of The Overview Effect, on a suborbital flight so he can experience first-hand the phenomenon he spent four decades documenting.',
  },
  {
    title: 'Your Mission: Go to Space with Frank White',
    date: '2026-03-13',
    url: 'https://www.globenewswire.com/news-release/2026/03/13/3255658/0/en/your-mission-go-to-space-with-frank-white.html',
    source: 'GlobeNewswire',
    summary:
      'Wire announcement of the Overview Effect campaign, in which any contributor can win a seat alongside Frank White.',
  },
  {
    title: 'A New Era Begins: Decoding the Lunar Decade',
    date: '2026-02-13',
    url: 'https://news.moondao.com/posts/shifting-timelines-how-the-moon-became-the-priority',
    source: 'MoonDAO Newsletter',
    summary:
      'MoonDAO lays out how national and commercial timelines converged on the Moon, and what that shift means for its settlement roadmap.',
  },
  {
    title: '2025 Year in Review',
    date: '2025-12-18',
    url: 'https://news.moondao.com/posts/2025-year-in-review',
    source: 'MoonDAO Newsletter',
    summary:
      "A full accounting of MoonDAO's 2025: projects funded, governance changes, the lunar bounty, and the launch of the Launchpad.",
  },
  {
    title: 'Support the Inspiration4 Complex at Space Camp',
    date: '2025-10-16',
    url: 'https://news.moondao.com/posts/support-the-inspiration4-complex-at-space-camp',
    source: 'MoonDAO Newsletter',
    summary:
      'The first mission to run on the MoonDAO Launchpad, raising funds for the Inspiration4 Complex at Space Camp.',
  },
  {
    title: 'The Constitution of the Moon Reaches the Lunar Surface',
    date: '2025-03-11',
    url: 'https://news.moondao.com/posts/lunar-bounty-has-landed-on-moon',
    source: 'MoonDAO Newsletter',
    summary:
      "MoonDAO's Constitution of the Moon and a lunar bounty wallet land in Mare Crisium aboard Firefly Aerospace's Blue Ghost, carried in the LifeShip payload.",
  },
  {
    title: 'Launching Today: The Space Acceleration Network',
    date: '2024-10-10',
    url: 'https://news.moondao.com/posts/launching-today-the-space-acceleration-network',
    source: 'MoonDAO Newsletter',
    summary:
      'MoonDAO launches the Space Acceleration Network, an open directory connecting space companies, teams, and citizens working off-world.',
  },
  {
    title: 'We did it, MoonDAO!',
    date: '2024-09-10',
    url: 'https://news.moondao.com/posts/we-did-it-moondao',
    source: 'MoonDAO Newsletter',
    summary:
      'Dr. Eiman Jahangir returns from New Shepard NS-26, making him the second astronaut sent to space by a decentralized community vote.',
  },
  {
    title: "Back to Space: MoonDAO's 2nd Astronaut Takes Off This Week!",
    date: '2024-08-27',
    url: 'https://news.moondao.com/posts/back-to-space-moondao-s-2nd-astronaut-takes-off-this-week',
    source: 'MoonDAO Newsletter',
    summary:
      'Announcement of Dr. Eiman Jahangir launching aboard Blue Origin New Shepard NS-26 on August 29, 2024.',
  },
  {
    title: 'Prepare to Launch: The Ticket to Space Sweepstakes',
    date: '2023-12-06',
    url: 'https://news.moondao.com/posts/prepare-to-launch',
    source: 'MoonDAO Newsletter',
    summary:
      "MoonDAO reopens the sweepstakes for its second Blue Origin seat, giving the community a free path to becoming MoonDAO's next astronaut.",
  },
  {
    title: 'MoonDAO can send users to outer space with a free NFT collection',
    date: '2022-06-01',
    url: 'https://www.timesnewswire.com/pressrelease/moondao-announced-that-it-can-send-users-to-outer-space-with-a-free-nft-collection/',
    source: 'Times Newswire',
    summary:
      'MoonDAO announces the Ticket to Space NFT, a free collection that entered holders into the draw for a seat aboard New Shepard.',
  },
]

export const MEDIA_COVERAGE: CoverageItem[] = [
  {
    outlet: 'Business Insider',
    title: 'Your Mission: Go to Space with Frank White',
    date: '2026-03-13',
    url: 'https://markets.businessinsider.com/news/currencies/your-mission-go-to-space-with-frank-white-1035925299',
  },
  {
    outlet: 'Yahoo Finance',
    title: 'Your Mission: Go to Space with Frank White',
    date: '2026-03-13',
    url: 'https://finance.yahoo.com/news/mission-space-frank-white-153700223.html',
  },
  {
    outlet: 'Space.com',
    title:
      'Cardiologist rockets to the final frontier on Blue Origin suborbital spaceflight, thanks to MoonDAO',
    date: '2024-09-29',
    url: 'https://www.space.com/blue-origin-eiman-jahangir-suborbital-flight-moondao',
    logo: '/assets/logo-spacedotcom.svg',
  },
  {
    outlet: 'NewsChannel 5 Nashville',
    title:
      "'I've imagined being this person for a long time': Nashville doctor takes suborbital flight",
    date: '2024-09-04',
    url: 'https://www.newschannel5.com/news/ive-imagined-being-this-person-for-a-long-time-nashville-doctor-space-enthusiast-takes-suborbital-flight',
  },
  {
    outlet: 'The Tennessean',
    title: "Vanderbilt cardiologist on Blue Origin flight to space: 'It was incredible'",
    date: '2024-08-29',
    url: 'https://www.tennessean.com/story/news/local/2024/08/29/eiman-jahangir-vanderbilt-blue-origin-new-shepard-first-nashvillian-space/74996549007/',
  },
  {
    outlet: 'WSMV 4 Nashville',
    title: "Tennessee doctor among '6 people having their minds blown' during space launch",
    date: '2024-08-29',
    url: 'https://www.wsmv.com/2024/08/29/tn-doctor-among-6-people-having-their-minds-blown-during-space-launch/',
  },
  {
    outlet: 'Vanderbilt University',
    title: 'MPH Graduate Eiman Jahangir Heads to Space with Blue Origin Space Launch',
    date: '2024-08-29',
    url: 'https://medschool.vanderbilt.edu/2024/08/29/mph-graduate-eiman-jahangir-blue-origin-space-launch/',
  },
  {
    outlet: 'MSN',
    title:
      'Representation matters: Vanderbilt doctor to become first Nashvillian to go to outer space',
    date: '2024-08',
    url: 'https://www.msn.com/en-us/money/other/representation-matters-vanderbilt-doctor-to-become-first-nashvillian-to-go-outer-space/ar-AA1oRGNM',
    logo: '/assets/logo-msn.svg',
  },
  {
    outlet: 'Space Impulse',
    title: "Cardiologist's Dream Of Space Takes Flight With MoonDAO Selection",
    date: '2024-07-08',
    url: 'https://spaceimpulse.com/2024/07/08/cardiologists-dream-of-space-takes-flight-with-moondao-selection/',
  },
  {
    outlet: 'Vanderbilt University Medical Center',
    title:
      'The stars look very different today: Eiman Jahangir to realize lifelong dream to fly to space',
    date: '2024-04-24',
    url: 'https://news.vumc.org/2024/04/24/eiman-jahangir-to-realize-lifelong-dream-to-fly-to-space/',
  },
  {
    outlet: 'NewsNation',
    title: 'Vanderbilt doctor to go to space on Blue Origin flight',
    date: '2024',
    url: 'https://www.newsnationnow.com/good-news/vanderbilt-doctor-to-go-to-space-on-blue-origin-flight/',
  },
  {
    outlet: 'Cointelegraph',
    title: "Lunar colony 'unlikely' by 2030, but that's not the point — MoonDAO",
    date: '2024-01-23',
    url: 'https://cointelegraph.com/news/moondao-crypto-space-moon-mission-funding-research',
  },
  {
    outlet: 'Houston Chronicle',
    title:
      "Crypto in space? As markets overlap, some see blockchain's potential in growing off-planet economy",
    date: '2023',
    url: 'https://www.houstonchronicle.com/news/houston-texas/space/article/cryptocurrency-blockchain-space-overlap-17753964.php',
    logo: '/assets/logo-houston-chronicle.svg',
  },
  {
    outlet: 'Forbes',
    title: "The Crypto Community That's Going To The Moon – Literally",
    date: '2022-11-09',
    url: 'https://www.forbes.com/sites/zengernews/2022/11/09/the-crypto-community-thats-going-to-the-moonliterally/',
    logo: '/assets/logo-forbes.svg',
  },
  {
    outlet: 'CoinDesk',
    title: 'A DAO That Literally Wants to Party on the Moon Just Sent a Viral YouTuber to Space',
    date: '2022-08-06',
    url: 'https://www.coindesk.com/business/2022/08/06/a-dao-that-literally-wants-to-party-on-the-moon-just-sent-a-viral-youtuber-to-space',
  },
  {
    outlet: 'Quartz',
    title: "Space Business: MoonDAO's Golden Tickets",
    date: '2022-08-04',
    url: 'https://qz.com/emails/space-business/1849365590/space-business-moondaos-golden-tickets',
  },
  {
    outlet: 'Space.com',
    title: "Blue Origin launches 6 people on company's 6th space tourism mission",
    date: '2022-08-04',
    url: 'https://www.space.com/blue-origin-ns-22-space-tourist-flight-success',
    logo: '/assets/logo-spacedotcom.svg',
  },
  {
    outlet: 'Spaceflight Now',
    title: 'Blue Origin launches six more passengers to suborbital space',
    date: '2022-08-04',
    url: 'https://spaceflightnow.com/2022/08/04/blue-origin-ns-22-live-coverage/',
  },
  {
    outlet: 'Local Profile',
    title: "Dude Perfect's Coby Cotton Flying To Space With Blue Origin",
    date: '2022-08-04',
    url: 'https://www.localprofile.com/news/dude-perfect-coby-cotton-flying-space-7505388',
  },
  {
    outlet: 'SlashGear',
    title: 'The Bizarre Story Of How Dude Perfect Got A Chance To Go To Space',
    date: '2022-08-04',
    url: 'https://www.slashgear.com/952622/the-bizarre-story-of-how-dude-perfect-got-a-chance-to-go-to-space/',
  },
  {
    outlet: 'Dallas Morning News',
    title: 'Co-founder of Frisco-based Dude Perfect is set to go to space',
    date: '2022-08-01',
    url: 'https://www.dallasnews.com/business/local-companies/2022/08/01/co-founder-of-frisco-based-dude-perfect-is-set-to-go-to-space/',
  },
  {
    outlet: 'Phys.org',
    title: 'Co-founder of Texas-based Dude Perfect is set to go to space',
    date: '2022-08',
    url: 'https://phys.org/news/2022-08-co-founder-texas-based-dude-space.html',
    logo: '/assets/logo-phys.svg',
  },
  {
    outlet: 'News18',
    title: "'Dude Perfect' YouTuber Jets Off to Space With Free Ticket Aboard Blue Origin Flight",
    date: '2022-08',
    url: 'https://www.news18.com/news/buzz/dude-perfect-youtuber-jets-off-to-space-with-free-ticket-aboard-blue-origin-flight-6322909.html',
  },
  {
    outlet: 'Space.com',
    title: 'Blue Origin announces crew for 6th suborbital space tourism launch',
    date: '2022-07-23',
    url: 'https://www.space.com/blue-origin-crew-ns-22-announced',
    logo: '/assets/logo-spacedotcom.svg',
  },
  {
    outlet: 'CNET',
    title: 'MoonDAO Will Pick 2 of the Next Blue Origin Astronauts With the Help of NFTs',
    date: '2022-06-09',
    url: 'https://www.cnet.com/science/space/moondao-will-pick-2-of-the-next-blue-origin-astronauts-with-the-help-of-nfts/',
    logo: '/assets/logo-cnet.svg',
  },
  {
    outlet: 'HackerNoon',
    title: "On MoonDAO's Unending Ambition to Decentralize The Space Industry",
    date: '2022-02-25',
    url: 'https://hackernoon.com/on-moondaos-unending-ambition-to-decentralize-the-space-industry',
  },
  {
    outlet: 'VICE',
    title: "Investors in 'MoonDAO' Think They'll Go to Space on a Billionaire's Rocket",
    date: '2022-01-26',
    url: 'https://www.vice.com/en/article/4aw4wj/investors-in-moondao-think-theyll-go-to-space-on-a-billionaires-rocket',
    logo: '/assets/logo-vice.svg',
  },
]

export const PODCAST_APPEARANCES: MediaAppearance[] = [
  {
    program: 'The Space Show',
    title: 'Frank White & Pablo Moncada-Larrotiz on decentralized funding for spaceflight',
    date: '2026-03-28',
    url: 'https://doctorspace.substack.com/p/the-space-show-presents-frank-white',
  },
  {
    program: 'Space Café Podcast',
    title: 'Beyond Billionaires: MoonDAO and the Radical Vision of a Decentralized Space Economy',
    date: '2025-01-28',
    url: 'https://www.buzzsprout.com/1915816/episodes/16529164-beyond-billionaires-moondao-and-the-radical-vision-of-a-decentralized-space-economy',
  },
  {
    program: 'Space and Things',
    title: 'Winning a Trip to Space with Dr. Eiman Jahangir',
    date: '2024-05-23',
    url: 'https://spaceandthingspodcast.com/podcast/stp195-winning-a-trip-to-space-with-dr-eiman-jahangir',
  },
  {
    program: 'The Space Revolution with Rick Tumlinson',
    title: 'Episode 21: Pablo Moncada-Larrotiz',
    date: '2023-09-06',
    url: 'https://podcasts.apple.com/gb/podcast/episode-21-pablo-moncada/id1659076624?i=1000626953339',
  },
  {
    program: 'Astro Ben',
    title: 'Pablo Moncada-Larrotiz, Co-founder of MoonDAO',
    url: 'https://astroben.libsyn.com/pablo-moncada-larrotiz-co-founder-of-moondao',
  },
  {
    program: 'Astro Ben',
    title: 'Dr. Eiman Jahangir on going to space with MoonDAO',
    url: 'https://astroben.libsyn.com/dr-eiman-jahangir-associate-professor-at-vanderbilt-university-and-the-director-of-the-sections-of-general-cardiology-and-cardio-oncology-hes-also-going-to-space-with-moondao',
  },
  {
    program: 'The Interplanetary Podcast',
    title: 'Dr. Eiman Jahangir on New Shepard',
    url: 'https://soundcloud.com/matt-interplanetary/306-dr-eiman-jahangir-new-shepard',
  },
]

export const VIDEO_APPEARANCES: MediaAppearance[] = [
  {
    program: 'Dude Perfect',
    title: 'Dude Perfect goes to SPACE',
    url: 'https://www.youtube.com/watch?v=YXXlSG-du7c',
  },
  {
    program: 'Ellie in Space',
    title: 'How Dude Perfect was Sent to Space',
    url: 'https://www.youtube.com/watch?v=u0sUwRWWZe0',
  },
  {
    program: 'WKRN Nashville',
    title: 'Vanderbilt doctor prepares to be an astronaut',
    url: 'https://www.youtube.com/watch?v=YsofvOAKG3E',
  },
  {
    program: 'Foresight Institute',
    title: 'Decentralized Approaches to Support Space Progress',
    url: 'https://www.youtube.com/watch?v=huNZxzM5u3w',
  },
  {
    program: 'DAO Denver',
    title: 'MoonDAO, A Fireside Chat with Pablo Moncada',
    url: 'https://www.youtube.com/watch?v=VYhZ6YeDP18',
  },
  {
    program: 'Mars Society Convention',
    title: 'Decentralized Funding for Public Access to Space',
    url: 'https://www.youtube.com/watch?v=I4MIL6-7jEU',
  },
  {
    program: 'New Worlds Conference',
    title: 'MoonDAO at New Worlds',
    url: 'https://www.youtube.com/watch?v=BGMq5V-BGnY',
  },
]

export const SPOKESPEOPLE: Spokesperson[] = [
  {
    name: 'Pablo Moncada-Larrotiz',
    role: 'Co-founder',
    bio: "Pablo co-founded MoonDAO at the end of 2021 and served as its first elected Executive Lead. He previously worked at Waymo, Google's self-driving car division, and on YouTube VR, leaving big tech after concluding that centralized control over billions of lives was better answered by decentralization. He studied at the University of Michigan and grew up between Ann Arbor and Zaragoza, Spain.",
  },
  {
    name: 'Dr. Eiman Jahangir',
    role: "MoonDAO's second astronaut",
    bio: 'A cardiologist and associate professor at Vanderbilt University Medical Center, Dr. Jahangir was selected by MoonDAO through an open sweepstakes and flew aboard Blue Origin New Shepard NS-26 on August 29, 2024, becoming the first Nashvillian in space after applying to NASA twice.',
    image: '/assets/eiman-jahangir.png',
  },
  {
    name: 'Coby Cotton',
    role: "MoonDAO's first astronaut",
    bio: 'Co-founder of the YouTube sports-entertainment group Dude Perfect, Coby was chosen by MoonDAO token holders to use the first of its two Blue Origin seats. He flew aboard New Shepard NS-22 on August 4, 2022, in the first human spaceflight ever crowdfunded by an online community.',
    image: '/assets/coby-cotton.png',
  },
]

export const BRAND_ASSETS: BrandAsset[] = [
  {
    name: 'Full logo pack',
    description: 'High-resolution MoonDAO logos, wordmarks, and graphics.',
    href: 'https://drive.google.com/drive/folders/1xFv7fFPVLUKWPhd9LKd7-PWYH28WyUGP',
    external: true,
  },
  {
    name: 'MoonDAO logo (color)',
    description: 'Primary mark, SVG.',
    href: '/assets/moondao-logo.svg',
  },
  {
    name: 'MoonDAO logo (white)',
    description: 'For dark backgrounds, SVG.',
    href: '/assets/MoonDAO-Logo-White.svg',
  },
  {
    name: 'Animated logo',
    description: 'Animated mark for video and broadcast, SVG.',
    href: '/assets/MoonDAO%20Animated%20Logo%20-%20Original.svg',
  },
  {
    name: 'Space Acceleration Network logo',
    description: 'Mark for the Space Acceleration Network, SVG.',
    href: '/assets/logo-san-full.svg',
  },
  {
    name: 'Launchpad logo',
    description: 'Mark for the MoonDAO Launchpad, SVG.',
    href: '/assets/MoonDAOLaunchpad.svg',
  },
]

export const PRESS_IMAGERY: BrandAsset[] = [
  {
    name: 'Coby Cotton, NS-22',
    description: "MoonDAO's first astronaut.",
    href: '/assets/astronaut-coby.png',
  },
  {
    name: 'Dr. Eiman Jahangir, NS-26',
    description: "MoonDAO's second astronaut.",
    href: '/assets/astronaut-eiman.png',
  },
  {
    name: 'Both MoonDAO astronauts',
    description: 'Coby Cotton and Dr. Eiman Jahangir.',
    href: '/assets/Astronauts.png',
  },
]
