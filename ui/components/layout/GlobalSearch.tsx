import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { XMarkIcon } from '@heroicons/react/24/outline'

// Search mappings for intelligent routing
const searchMappings = [
  // Constitution & Governance
  {
    keywords: ['constitution', 'rules', 'laws', 'governance', 'govern', 'charter', 'bylaws', 'founding', 'principles', 'structure'],
    title: 'Constitution',
    description: 'Read MoonDAO\'s founding principles and governance structure',
    link: '/constitution',
    category: 'Governance'
  },
  {
    keywords: ['vote', 'voting', 'proposal', 'proposals', 'governance', 'ballot', 'election', 'participate', 'decision', 'choose'],
    title: 'Vote on Proposals',
    description: 'Participate in MoonDAO governance by voting on proposals',
    link: '/vote',
    category: 'Governance'
  },
  {
    keywords: ['governance', 'govern', 'dao', 'decentralized', 'decision', 'community', 'hub', 'system'],
    title: 'Governance Hub',
    description: 'Learn about MoonDAO\'s governance system',
    link: '/governance',
    category: 'Governance'
  },

  // Token & Economy
  {
    keywords: ['mooney', 'token', 'buy', 'purchase', 'get', 'acquire', 'currency', 'where can i buy', 'how to buy', 'buying', 'purchasing', 'obtain', 'find', 'exchange', 'trade', 'swap'],
    title: 'Get $MOONEY',
    description: 'Buy MOONEY tokens to participate in the ecosystem',
    link: '/get-mooney',
    category: 'Token'
  },
  {
    keywords: ['lock', 'locking', 'vmooney', 'voting power', 'stake', 'staking', 'escrow', 'earn', 'rewards', 'vote power', 'lock tokens', 'staking tokens'],
    title: 'Lock Tokens',
    description: 'Lock MOONEY tokens to earn voting power',
    link: '/lock',
    category: 'Token'
  },

  // Network & Community
  {
    keywords: ['network', 'community', 'members', 'citizens', 'teams', 'explore', 'discover', 'people', 'users', 'acceleration network', 'space network'],
    title: 'Explore Network',
    description: 'Discover citizens and teams in the Space Acceleration Network',
    link: '/network',
    category: 'Network'
  },
  {
    keywords: ['join', 'citizen', 'membership', 'become', 'participate', 'register', 'sign up', 'how to join', 'become member', 'citizen registration'],
    title: 'Join the Network',
    description: 'Become a citizen and join the space community',
    link: '/join',
    category: 'Network'
  },
  {
    keywords: ['team', 'teams', 'create team', 'organization', 'group', 'collaborate', 'form team', 'start team', 'make team', 'teamwork'],
    title: 'Create a Team',
    description: 'Form a team to work on space projects together',
    link: '/team',
    category: 'Network'
  },

  // Projects & Jobs
  {
    keywords: ['projects', 'project', 'rewards', 'funding', 'grants', 'proposals', 'space projects', 'fund projects', 'project funding', 'discovery'],
    title: 'Project Rewards',
    description: 'Discover and fund space exploration projects',
    link: '/projects',
    category: 'Projects'
  },
  {
    keywords: ['launchpad', 'launch pad', 'startup', 'accelerator', 'launch', 'new projects', 'venture', 'fundraise', 'mission'],
    title: 'Launchpad',
    description: 'Launch your space venture with MoonDAO support',
    link: '/launchpad',
    category: 'Projects'
  },
  {
    keywords: ['jobs', 'careers', 'work', 'employment', 'opportunities', 'hiring', 'job board', 'find work', 'career opportunities', 'space jobs', 'space careers'],
    title: 'Jobs Board',
    description: 'Find career opportunities in the space industry',
    link: '/jobs',
    category: 'Jobs'
  },
  {
    keywords: ['contribute', 'contribution', 'submit', 'work', 'help', 'skills', 'contribute skills', 'how to help', 'volunteer', 'participate'],
    title: 'Submit Contribution',
    description: 'Contribute your skills to MoonDAO projects',
    link: '/contributions',
    category: 'Projects'
  },

  // Learn & Info
  {
    keywords: ['about', 'mission', 'vision', 'story', 'history', 'what is', 'what is moondao', 'about moondao', 'mission statement', 'goals'],
    title: 'About MoonDAO',
    description: 'Learn about MoonDAO\'s mission and vision',
    link: '/about',
    category: 'Learn'
  },
  {
    keywords: ['news', 'updates', 'blog', 'announcements', 'articles', 'latest news', 'recent updates', 'current news', 'what\'s new'],
    title: 'Latest News',
    description: 'Stay updated with MoonDAO news and announcements',
    link: '/news',
    category: 'Learn'
  },
  {
    keywords: ['analytics', 'data', 'statistics', 'metrics', 'dashboard', 'stats', 'numbers', 'tracking', 'performance'],
    title: 'Analytics Dashboard',
    description: 'View MoonDAO metrics and analytics',
    link: '/analytics',
    category: 'Learn'
  },
  {
    keywords: ['faq', 'help', 'questions', 'support', 'guide', 'how to', 'frequently asked', 'common questions', 'assistance', 'tutorial'],
    title: 'FAQ & Help',
    description: 'Get answers to frequently asked questions',
    link: '/faq',
    category: 'Learn'
  },

  // Marketplace
  {
    keywords: ['shop', 'store', 'marketplace', 'buy', 'merchandise', 'products', 'shopping', 'items', 'goods', 'purchase items', 'sell'],
    title: 'Marketplace',
    description: 'Shop for MoonDAO merchandise and products',
    link: '/marketplace',
    category: 'Shop'
  }
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
          className="bg-black/70 backdrop-blur-md border border-white/20 rounded-full p-3 text-white hover:bg-black/80 transition-all shadow-lg"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}

      {/* Expanded state - full search bar */}
      {isExpanded && (
        <div className="w-80">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              placeholder="Search..."
              className="w-full pl-10 pr-12 py-3 bg-black/70 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all relative z-0"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {isOpen && results.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {results.map((result, index) => (
                <button
                  key={`${result.link}-${index}`}
                  onClick={() => handleResultClick(result)}
                  className={`w-full px-4 py-3 text-left hover:bg-white/10 focus:bg-white/10 focus:outline-none transition-colors border-b border-white/5 last:border-b-0 ${
                    index === selectedIndex ? 'bg-white/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white truncate">{result.title}</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full shrink-0">
                          {result.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">{result.description}</p>
                    </div>
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
