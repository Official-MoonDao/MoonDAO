import {
  PlusIcon,
  PlusCircleIcon,
  QueueListIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid'
import { NanceProvider } from '@nance/nance-hooks'
import { StringParam, useQueryParams, withDefault } from 'next-query-params'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useDebounce } from 'react-use'
import { NANCE_API_URL } from '../lib/nance/constants'
import Head from '../components/layout/Head'
import ProposalList from '../components/nance/ProposalList'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Search from '@/components/layout/Search'
import StandardButton from '@/components/layout/StandardButton'
import StandardButtonPlus from '@/components/layout/StandardButtonPlus'

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

  const descriptionSection = (
    <div className="pt-2">
      <p>
        Cast your vote for active proposals and view the vote record and history
        for all past proposals. You can{' '}
        <u>
          <Link href="/submit">submit a proposal</Link>
        </u>{' '}
        to receive financing or support from the MoonDAO community. Please refer
        to{' '}
        <u>
          <Link
            href="https://docs.moondao.com/Projects/Project-System"
            target="_blank"
            rel="noreferrer"
          >
            our documentation
          </Link>
        </u>{' '}
        for more details on the project system and governance processes.
      </p>
      <StandardButtonPlus
        link="/submit"
        className="mt-4 gradient-2 rounded-full"
      >
        Create a Proposal
      </StandardButtonPlus>
    </div>
  )

  return (
    <section id="all-proposals-container" className="overflow-hidden">
      <Head title="All Proposals" />
      <Container>
        <ContentLayout
          header="Proposals"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={
            <NoticeFooter 
              defaultImage="../assets/MoonDAO-Logo-White.svg"
              defaultTitle="Need Help?"
              defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
              defaultButtonText="Submit a Ticket"
              defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
              imageWidth={200}
              imageHeight={200}
            />
          }
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="pb-10 w-full">
            <NanceProvider apiUrl={NANCE_API_URL}>
              <ProposalList />
            </NanceProvider>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
