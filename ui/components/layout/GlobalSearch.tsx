import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { XMarkIcon } from '@heroicons/react/24/outline'

// Search mappings for intelligent routing
const searchMappings = [
  // ── Governance ────────────────────────────────────────────────────────────
  {
    keywords: [
      'governance', 'govern', 'dao', 'decentralized', 'voting hub', 'treasury governance',
      'citizen governance', 'community decisions', 'how governance works', 'city hall',
    ],
    title: 'Governance',
    description: "MoonDAO's governance hub — project proposals, governance votes, constitution and more",
    link: '/governance',
    category: 'Governance',
  },
  {
    keywords: [
      'constitution', 'rules', 'laws', 'charter', 'bylaws', 'founding principles',
      'governance structure', 'how moondao works', 'operating agreement',
    ],
    title: 'Constitution',
    description: "Read MoonDAO's Constitution — our founding principles and governance rules",
    link: '/constitution',
    category: 'Governance',
  },
  {
    keywords: [
      'governance proposals', 'governance vote', 'non-project proposal', 'policy change',
      'amendment', 'snapshot vote', 'offchain vote', 'governance ballot',
    ],
    title: 'Governance Proposals',
    description: 'Vote on non-project governance proposals — amendments, policy changes, and more',
    link: '/governance-proposals',
    category: 'Governance',
  },
  {
    keywords: [
      'propose project', 'submit proposal', 'project proposal', 'request funding',
      'get funded', 'create proposal', 'nance', 'new proposal', 'project application',
    ],
    title: 'Propose a Project',
    description: 'Submit a proposal to receive financing or permissions from the MoonDAO community',
    link: '/proposals',
    category: 'Governance',
  },
  {
    keywords: [
      'projects', 'project rewards', 'fund project', 'active projects', 'current projects',
      'project voting', 'vote project', 'project funding', 'rewards cycle', 'distributions',
    ],
    title: 'Project Rewards',
    description: 'Browse active and past projects — vote on funding distributions each quarter',
    link: '/projects',
    category: 'Governance',
  },

  // ── Token & Economy ───────────────────────────────────────────────────────
  {
    keywords: [
      'get mooney', 'buy mooney', 'purchase mooney', 'acquire mooney', 'swap for mooney',
      'how to buy', 'where to buy', 'mooney token swap', 'buy token', 'get token',
    ],
    title: 'Get $MOONEY',
    description: 'Swap for MOONEY tokens — available on Ethereum, Arbitrum, Polygon and Base',
    link: '/get-mooney',
    category: 'Token',
  },
  {
    keywords: [
      'mooney', 'token', 'tokenomics', 'fixed supply', 'mooney info', 'what is mooney',
      'token details', 'multi-chain token', 'mooney overview', 'quadratic voting token',
    ],
    title: 'MOONEY Token',
    description: 'Learn about MOONEY — fixed supply of 2.53B, quadratic voting, multi-chain',
    link: '/mooney',
    category: 'Token',
  },
  {
    keywords: [
      'lock mooney', 'locking', 'vmooney', 'voting power', 'stake', 'staking', 'escrow',
      'earn voting power', 've token', 'lock tokens', 'get vmooney',
    ],
    title: 'Lock $MOONEY',
    description: 'Lock MOONEY to earn vMOONEY voting power for governance participation',
    link: '/lock',
    category: 'Token',
  },
  {
    keywords: [
      'bridge', 'bridge mooney', 'arbitrum bridge', 'ethereum to arbitrum', 'cross chain',
      'transfer mooney', 'move tokens', 'layer 2', 'faster transactions', 'lower fees',
    ],
    title: 'Bridge MOONEY',
    description: 'Bridge MOONEY from Ethereum mainnet to Arbitrum for faster, cheaper transactions',
    link: '/bridge',
    category: 'Token',
  },

  // ── Network & Community ───────────────────────────────────────────────────
  {
    keywords: [
      'network', 'explore network', 'community', 'citizens', 'teams', 'members',
      'space acceleration network', 'san', 'discover people', 'browse members',
    ],
    title: 'Explore Network',
    description: 'Discover citizens and teams building the future of space exploration',
    link: '/network',
    category: 'Network',
  },
  {
    keywords: [
      'join', 'become citizen', 'citizenship', 'membership', 'register', 'sign up',
      'join moondao', 'how to join', 'citizen nft', 'citizen pass', 'get citizen',
    ],
    title: 'Join MoonDAO',
    description: 'Become a Citizen of the Space Acceleration Network',
    link: '/join',
    category: 'Network',
  },
  {
    keywords: [
      'team', 'create team', 'form team', 'start team', 'organization', 'group',
      'collaborate', 'team nft', 'moondao team', 'build team',
    ],
    title: 'Create a Team',
    description: 'Form a team to collaborate on space projects within MoonDAO',
    link: '/team',
    category: 'Network',
  },
  {
    keywords: [
      'map', 'member map', 'citizen map', 'world map', 'interactive globe', 'earth map',
      'moon map', 'where are citizens', 'citizen locations', 'globe', 'find nearby',
    ],
    title: 'Network Map',
    description: 'Interactive globe showing where citizens in the Space Acceleration Network are located',
    link: '/map',
    category: 'Network',
  },

  // ── Launchpad & Missions ──────────────────────────────────────────────────
  {
    keywords: [
      'launchpad', 'launch', 'mission', 'create mission', 'start mission', 'fundraise',
      'space venture', 'mission creator', 'launch mission', 'fund mission', 'raise capital',
    ],
    title: 'Launchpad',
    description: 'Launch a space mission or venture and raise funding from the MoonDAO community',
    link: '/launch',
    category: 'Launchpad',
  },
  {
    keywords: [
      'overview vote', 'frank white', 'fly to space', 'send citizen to space', 'astronaut vote',
      'overview token', 'overview delegation', 'space ticket', 'vote astronaut', 'overview mission',
      'leaderboard', 'citizen vote space',
    ],
    title: 'Fly to Space — Overview Vote',
    description: 'Vote for a citizen to fly to space alongside Frank White using Overview tokens',
    link: '/overview-vote',
    category: 'Launchpad',
  },

  // ── Contribute & Earn ─────────────────────────────────────────────────────
  {
    keywords: [
      'contribute', 'contribution', 'retroactive rewards', 'community rewards', 'quarterly rewards',
      'submit work', 'submit contribution', 'earn eth', 'earn vmooney', 'impact reward',
    ],
    title: 'Submit Contribution',
    description: 'Submit mission-aligned work for quarterly retroactive community rewards in ETH & vMOONEY',
    link: '/contributions',
    category: 'Contribute',
  },
  {
    keywords: [
      'submit', 'collaborate', 'contribute page', 'how to contribute', 'participate',
      'submit proposal or contribution',
    ],
    title: 'Collaborate & Contribute',
    description: 'Submit project proposals or contribution reports — two ways to work with MoonDAO',
    link: '/submit',
    category: 'Contribute',
  },
  {
    keywords: [
      'final report', 'project report', 'submit report', 'project completion', 'deliverables',
      'project outcomes', 'close project', 'end project',
    ],
    title: 'Submit Project Report',
    description: 'Submit a final report for your completed project — outcomes and deliverables',
    link: '/final-reports',
    category: 'Contribute',
  },
  {
    keywords: [
      'quests', 'quest', 'xp', 'experience points', 'earn xp', 'missions tasks', 'challenges',
      'reputation', 'contributor reputation', 'multiplanetary',
    ],
    title: 'Quests',
    description: 'Complete quests to earn XP and build your reputation in the Space Acceleration Network',
    link: '/quests',
    category: 'Contribute',
  },
  {
    keywords: [
      'jobs', 'job board', 'careers', 'employment', 'work', 'opportunities', 'hiring',
      'space jobs', 'space careers', 'find work', 'team jobs',
    ],
    title: 'Jobs Board',
    description: 'Find job opportunities with teams building the future of space exploration',
    link: '/jobs',
    category: 'Contribute',
  },

  // ── Learn & Info ──────────────────────────────────────────────────────────
  {
    keywords: [
      'about', 'about moondao', 'what is moondao', 'mission', 'vision', 'story', 'history',
      'internet space program', 'lunar settlement', 'multiplanetary', 'who is moondao',
    ],
    title: 'About MoonDAO',
    description: "Learn about MoonDAO — the internet's space program building toward a lunar settlement",
    link: '/about',
    category: 'Learn',
  },
  {
    keywords: [
      'info', 'information center', 'information', 'news updates', 'town hall summaries',
      'treasury info', 'faq info', 'learn more',
    ],
    title: 'Information Center',
    description: 'MoonDAO information hub — news, town halls, treasury and FAQs all in one place',
    link: '/info',
    category: 'Learn',
  },
  {
    keywords: [
      'townhall', 'town hall', 'town hall meeting', 'weekly meeting', 'community call',
      'meeting recording', 'meeting summary', 'watch meeting', 'town hall video',
    ],
    title: 'Town Hall Summaries',
    description: 'Watch recordings and read AI summaries of MoonDAO weekly town hall meetings',
    link: '/townhall',
    category: 'Learn',
  },
  {
    keywords: [
      'roadmap', 'milestones', 'phases', 'timeline', 'future plans', 'upcoming', 'schedule',
      'genesis phase', 'phase 0', 'what is next', 'moondao plan',
    ],
    title: 'Roadmap',
    description: "Explore MoonDAO's phased roadmap from genesis to lunar settlement",
    link: '/roadmap',
    category: 'Learn',
  },
  {
    keywords: [
      'resources', 'space resources', 'space data', 'nasa', 'space links', 'reference',
      'documentation', 'external links', 'space archives', 'research',
    ],
    title: 'Resources',
    description: 'Curated space research resources — NASA data, archives and external tools',
    link: '/resources',
    category: 'Learn',
  },
  {
    keywords: [
      'news', 'announcements', 'blog', 'articles', 'updates', 'latest news',
      'recent updates', "what's new", 'press',
    ],
    title: 'News',
    description: 'Stay updated with the latest MoonDAO news and announcements',
    link: '/news',
    category: 'Learn',
  },
  {
    keywords: [
      'treasury', 'analytics', 'finances', 'funds', 'budget', 'financial health',
      'treasury holdings', 'aum', 'transaction history', 'moondao money',
    ],
    title: 'Treasury',
    description: 'Transparent analytics on treasury holdings, transaction history and financial health',
    link: '/treasury',
    category: 'Learn',
  },
  {
    keywords: [
      'faq', 'frequently asked questions', 'help', 'support', 'common questions',
      'how to', 'tutorial', 'guide', 'getting started', 'assistance',
    ],
    title: 'FAQ',
    description: 'Answers to frequently asked questions about MoonDAO',
    link: '/faq',
    category: 'Learn',
  },
  {
    keywords: [
      'project system', 'project docs', 'project documentation', 'how projects work',
      'project guide', 'project lifecycle', 'project incentives', 'project tracking',
    ],
    title: 'Project System Docs',
    description: 'Learn how the MoonDAO project funding, tracking and incentive system works',
    link: '/project-system-docs',
    category: 'Learn',
  },

  // ── Marketplace ───────────────────────────────────────────────────────────
  {
    keywords: [
      'marketplace', 'shop', 'store', 'merchandise', 'products', 'nft listings',
      'buy items', 'sell items', 'shopping', 'goods', 'moondao merch',
    ],
    title: 'Marketplace',
    description: 'Buy and sell MoonDAO merchandise and NFT listings',
    link: '/marketplace',
    category: 'Shop',
  },
]

// Enhanced fuzzy matching function
function fuzzyMatch(query: string, text: string): number {
  const queryLower = query.toLowerCase().trim()
  const textLower = text.toLowerCase().trim()
  
  // Exact match gets highest score
  if (textLower === queryLower) return 1.0
  if (textLower.includes(queryLower)) {
    return 0.9 * (queryLower.length / textLower.length)
  }
  
  // Check for phrase matches (multiple words in sequence)
  const queryWords = queryLower.split(/\s+/)
  const textWords = textLower.split(/\s+/)
  
  // Look for consecutive word matches
  if (queryWords.length > 1) {
    for (let i = 0; i <= textWords.length - queryWords.length; i++) {
      const textSlice = textWords.slice(i, i + queryWords.length).join(' ')
      if (textSlice === queryLower) {
        return 0.8
      }
      if (textSlice.includes(queryLower)) {
        return 0.7
      }
    }
  }
  
  // Check for partial word matches with better scoring
  let matches = 0
  let totalWords = queryWords.length
  
  for (const queryWord of queryWords) {
    let bestMatch = 0
    for (const textWord of textWords) {
      if (textWord === queryWord) {
        bestMatch = 1.0
        break
      } else if (textWord.includes(queryWord)) {
        bestMatch = Math.max(bestMatch, 0.8 * (queryWord.length / textWord.length))
      } else if (queryWord.includes(textWord) && textWord.length > 2) {
        bestMatch = Math.max(bestMatch, 0.6 * (textWord.length / queryWord.length))
      }
    }
    matches += bestMatch
  }
  
  return matches / totalWords
}

// Enhanced search function
function searchMappingsFunction(query: string) {
  if (!query.trim()) return []
  
  const results = searchMappings
    .map(mapping => {
      const keywordScore = Math.max(
        ...mapping.keywords.map(keyword => fuzzyMatch(query, keyword))
      )
      const titleScore = fuzzyMatch(query, mapping.title) * 0.9
      const descriptionScore = fuzzyMatch(query, mapping.description) * 0.4
      
      const totalScore = Math.max(keywordScore, titleScore, descriptionScore)
      
      return { ...mapping, score: totalScore }
    })
    .filter(result => result.score > 0.2) // Lowered threshold for better coverage
    .sort((a, b) => b.score - a.score)
    .slice(0, 6) // Show more results
  
  return results
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isNavbarVisible, setIsNavbarVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track navbar visibility based on scroll - same logic as navbar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Show navbar if at top of page
      if (currentScrollY < 10) {
        setIsNavbarVisible(true)
      }
      // Hide when scrolling down, show when scrolling up
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsNavbarVisible(false)
      } else if (currentScrollY < lastScrollY) {
        setIsNavbarVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollY])

  useEffect(() => {
    if (query.trim()) {
      const searchResults = searchMappingsFunction(query)
      setResults(searchResults)
      setIsOpen(searchResults.length > 0)
    } else {
      setResults([])
      setIsOpen(false)
    }
    setSelectedIndex(-1)
  }, [query])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex])
        } else if (results[0]) {
          handleResultClick(results[0])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setIsExpanded(false)
        inputRef.current?.blur()
        break
    }
  }

  const handleResultClick = (result: any) => {
    router.push(result.link)
    setQuery('')
    setIsOpen(false)
    setIsExpanded(false)
    inputRef.current?.blur()
  }

  const clearSearch = () => {
    setQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  return (
    <div
      ref={searchRef}
      className={`fixed ${isNavbarVisible ? 'top-20' : 'top-4'} right-4 z-50 transition-all duration-300`}
    >
      {/* Collapsed state - just a search icon */}
      {!isExpanded && (
        <button
          onClick={toggleExpanded}
          className="bg-gradient-to-br from-dark-cool to-darkest-cool backdrop-blur-md border border-white/10 rounded-full p-3 text-white/80 hover:text-light-cool hover:border-light-cool/30 transition-all shadow-lg hover:shadow-light-cool/10"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}

      {/* Expanded state - full search bar */}
      {isExpanded && (
        <div className="w-72 md:w-80">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <svg className="h-4 w-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => query.trim() && setIsOpen(results.length > 0)}
              placeholder="Search MoonDAO..."
              className="w-full pl-10 pr-10 py-2.5 bg-gradient-to-br from-dark-cool to-darkest-cool backdrop-blur-md border border-white/10 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-light-cool/40 focus:ring-1 focus:ring-light-cool/20 transition-all"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button
                onClick={() => setIsExpanded(false)}
                className="text-white/40 hover:text-white/70 transition-colors p-0.5"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isOpen && results.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-gradient-to-b from-dark-cool to-darkest-cool backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {results.map((result, index) => (
                <button
                  key={`${result.link}-${index}`}
                  onClick={() => handleResultClick(result)}
                  className={`w-full px-4 py-3 text-left transition-all border-b border-white/5 last:border-b-0 group ${
                    index === selectedIndex 
                      ? 'bg-white/5' 
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-sm font-medium truncate transition-colors ${
                          index === selectedIndex ? 'text-light-cool' : 'text-white group-hover:text-light-cool'
                        }`}>
                          {result.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-white/5 text-white/50 rounded shrink-0 uppercase tracking-wide font-medium">
                          {result.category}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 line-clamp-1">{result.description}</p>
                    </div>
                    <svg 
                      className={`h-4 w-4 shrink-0 mt-0.5 transition-all ${
                        index === selectedIndex 
                          ? 'text-light-cool/60 translate-x-0' 
                          : 'text-white/20 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
