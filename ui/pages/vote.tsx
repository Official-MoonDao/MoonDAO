import {
  PlusIcon,
  QueueListIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid'
import { NanceProvider } from '@nance/nance-hooks'
import { StringParam, useQueryParams, withDefault } from 'next-query-params'
import { useEffect, useState } from 'react'
import { useDebounce } from 'react-use'
import { NANCE_API_URL } from '../lib/nance/constants'
import Head from '../components/layout/Head'
import ProposalList from '../components/nance/ProposalList'

const links = [
  {
    name: 'New Proposal',
    href: '#',
    description: 'Create a new proposal.',
    icon: PlusIcon,
  },
  {
    name: 'Queue Transactions',
    href: '#',
    description: 'Queue transactions from passed proposals.',
    icon: QueueListIcon,
  },
]

export default function SpaceIndex() {
  const [query, setQuery] = useQueryParams({
    keyword: withDefault(StringParam, undefined),
  })
  const [keywordInput, setKeywordInput] = useState<string | undefined>(
    query.keyword
  )

  useDebounce(
    () => {
      if (keywordInput !== query.keyword) {
        setQuery({ keyword: keywordInput || undefined })
      }
    },
    300,
    [keywordInput]
  )

  // Sync input state with searchParams
  useEffect(() => {
    if (keywordInput === undefined && query.keyword !== keywordInput) {
      setKeywordInput(query.keyword)
    }
  }, [query.keyword, keywordInput])

  // Cmd + K
  useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'k') {
        const searchField = document.getElementById('keyword')
        searchField?.focus()
      }
    }

    window.addEventListener('keydown', keyDownHandler)
    return () => {
      window.removeEventListener('keydown', keyDownHandler)
    }
  }, [])

  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn lg:px-3 lg:pb-14 lg:mt-1 md:max-w-[1080px]">
      <Head title="Vote" />
      <div className="absolute top-0 left-0 lg:left-[20px] h-[100vh] overflow-auto w-full py-5 lg:pl-10 lg:pr-8">
        <main className="flex-1">
          <NanceProvider apiUrl={NANCE_API_URL}>
            <div className="w-full px-2 lg:w-1/2 lg:ml-auto lg:mr-auto">
              <label htmlFor="search" className="sr-only">
                Search
              </label>
              <div className="relative text-gray-400 focus-within:text-gray-600">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <input
                  aria-label="Search proposals"
                  type="search"
                  name="keyword"
                  id="keyword"
                  className="block w-full rounded-md border-0 bg-white py-1.5 pl-10 pr-14 text-gray-900 focus:ring-2 focus:ring-white sm:text-sm sm:leading-6"
                  placeholder="Search"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
                  <kbd className="inline-flex items-center rounded border border-gray-200 px-1 font-sans text-xs text-gray-400">
                    ⌘K
                  </kbd>
                </div>
              </div>
            </div>
            <ProposalList />
          </NanceProvider>
        </main>
      </div>
    </div>
  )
}
