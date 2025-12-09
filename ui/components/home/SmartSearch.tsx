import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

// Search mappings for intelligent routing
const searchMappings = [
  // Constitution & Governance
  {
    keywords: ['constitution', 'rules', 'laws', 'governance', 'govern', 'charter', 'bylaws'],
    title: 'Constitution',
    description: 'Read MoonDAO\'s founding principles and governance structure',
    link: '/constitution',
    category: 'Governance'
  },
  {
    keywords: ['vote', 'voting', 'proposal', 'proposals', 'governance', 'ballot', 'election'],
    title: 'Vote on Proposals',
    description: 'Participate in MoonDAO governance by voting on proposals',
    link: '/projects',
    category: 'Governance'
  },
  {
    keywords: ['governance', 'govern', 'dao', 'decentralized', 'decision', 'community'],
    title: 'Governance Hub',
    description: 'Learn about MoonDAO\'s governance system',
    link: '/governance',
    category: 'Governance'
  },

  // Token & Economy
  {
    keywords: ['mooney', 'token', 'buy', 'purchase', 'get', 'acquire', 'currency'],
    title: 'Get $MOONEY',
    description: 'Buy MOONEY tokens to participate in the ecosystem',
    link: '/get-mooney',
    category: 'Token'
  },
  {
    keywords: ['lock', 'locking', 'vmooney', 'voting power', 'stake', 'staking', 'escrow'],
    title: 'Lock Tokens',
    description: 'Lock MOONEY tokens to earn voting power',
    link: '/lock',
    category: 'Token'
  },

  // Network & Community
  {
    keywords: ['network', 'community', 'members', 'citizens', 'teams', 'explore'],
    title: 'Explore Network',
    description: 'Discover citizens and teams in the Space Acceleration Network',
    link: '/network',
    category: 'Network'
  },
  {
    keywords: ['join', 'citizen', 'membership', 'become', 'participate', 'register'],
    title: 'Join the Network',
    description: 'Become a citizen and join the space community',
    link: '/join',
    category: 'Network'
  },
  {
    keywords: ['team', 'teams', 'create team', 'organization', 'group', 'collaborate'],
    title: 'Create a Team',
    description: 'Form a team to work on space projects together',
    link: '/team',
    category: 'Network'
  },

  // Projects & Jobs
  {
    keywords: ['projects', 'project', 'rewards', 'funding', 'grants', 'proposals'],
    title: 'Projects',
    description: 'Discover and fund space exploration projects',
    link: '/projects',
    category: 'Projects'
  },
  {
    keywords: ['jobs', 'careers', 'work', 'employment', 'opportunities', 'hiring'],
    title: 'Jobs Board',
    description: 'Find career opportunities in the space industry',
    link: '/jobs',
    category: 'Jobs'
  },
  {
    keywords: ['contribute', 'contribution', 'submit', 'work', 'help'],
    title: 'Submit Contribution',
    description: 'Contribute your skills to MoonDAO projects',
    link: '/contributions',
    category: 'Projects'
  },

  // Learn & Info
  {
    keywords: ['about', 'mission', 'vision', 'story', 'history', 'what is'],
    title: 'About MoonDAO',
    description: 'Learn about MoonDAO\'s mission and vision',
    link: '/about',
    category: 'Learn'
  },
  {
    keywords: ['news', 'updates', 'blog', 'announcements', 'articles'],
    title: 'Latest News',
    description: 'Stay updated with MoonDAO news and announcements',
    link: '/news',
    category: 'Learn'
  },
  {
    keywords: ['events', 'calendar', 'meetings', 'conferences', 'workshops'],
    title: 'Upcoming Events',
    description: 'Join MoonDAO events and community gatherings',
    link: '/events',
    category: 'Learn'
  },
  {
    keywords: ['analytics', 'data', 'statistics', 'metrics', 'dashboard'],
    title: 'Analytics Dashboard',
    description: 'View MoonDAO metrics and analytics',
    link: '/analytics',
    category: 'Learn'
  },
  {
    keywords: ['faq', 'help', 'questions', 'support', 'guide', 'how to'],
    title: 'FAQ & Help',
    description: 'Get answers to frequently asked questions',
    link: '/faq',
    category: 'Learn'
  },

  // Marketplace
  {
    keywords: ['shop', 'store', 'marketplace', 'buy', 'merchandise', 'products', 'sell'],
    title: 'Marketplace',
    description: 'Shop for MoonDAO merchandise and products',
    link: '/marketplace',
    category: 'Shop'
  }
]

// Fuzzy matching function
function fuzzyMatch(query: string, text: string): number {
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  
  // Exact match gets highest score
  if (textLower.includes(queryLower)) {
    return queryLower.length / textLower.length
  }
  
  // Check for partial word matches
  const queryWords = queryLower.split(' ')
  const textWords = textLower.split(' ')
  
  let matches = 0
  for (const queryWord of queryWords) {
    for (const textWord of textWords) {
      if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
        matches++
        break
      }
    }
  }
  
  return matches / queryWords.length
}

// Search function
function searchMappingsFunction(query: string) {
  if (!query.trim()) return []
  
  const results = searchMappings
    .map(mapping => {
      const keywordScore = Math.max(
        ...mapping.keywords.map(keyword => fuzzyMatch(query, keyword))
      )
      const titleScore = fuzzyMatch(query, mapping.title) * 0.8
      const descriptionScore = fuzzyMatch(query, mapping.description) * 0.3
      
      const totalScore = Math.max(keywordScore, titleScore, descriptionScore)
      
      return { ...mapping, score: totalScore }
    })
    .filter(result => result.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  
  return results
}

export default function SmartSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        inputRef.current?.blur()
        break
    }
  }

  const handleResultClick = (result: any) => {
    router.push(result.link)
    setQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const clearSearch = () => {
    setQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={searchRef} className="relative w-full max-w-lg">
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
          placeholder="Search for governance, tokens, projects..."
          className="w-full pl-10 pr-10 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all relative z-0"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
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
  )
}
