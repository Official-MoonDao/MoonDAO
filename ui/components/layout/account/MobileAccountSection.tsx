import { Disclosure } from '@headlessui/react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { usePrivy } from '@privy-io/react-auth'
import { useContext } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { ACCOUNT_ACTIONS } from '@/lib/navigation/nav-config'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { NavLink } from '../NavLink'
import { UserProjectsList } from './UserProjectsList'
import { UserTeamsList } from './UserTeamsList'

const ITEM_CLASS =
  'block w-full text-left px-2 py-2 rounded-md text-white hover:bg-white/10 transition-colors duration-200'

/**
 * The mobile counterpart to `AccountMenu`: the signed-in user's own profile,
 * teams, projects, and creation actions, kept separate from the public groups
 * below it in the drawer.
 *
 * The two lists sit behind collapsed disclosures on purpose. Each one runs an
 * on-chain role-hat scan when it mounts, and opening the drawer should not be
 * enough to start one — the same reason they are not in the public nav.
 */
export default function MobileAccountSection({
  onNavigate,
}: {
  onNavigate?: () => void
}) {
  const { citizen } = useContext(CitizenContext)
  const account = useActiveAccount()
  const { authenticated } = usePrivy()

  if (!authenticated && !account?.address) return null

  const citizenName = citizen?.metadata?.name
  const profileHref = citizenName
    ? `/citizen/${generatePrettyLinkWithId(citizenName, citizen.metadata.id)}`
    : null

  return (
    <div className="mb-4 pb-4 border-b border-white/10 font-RobotoMono text-sm md:text-base">
      <p className="px-2 pb-1 text-xs text-gray-400 font-medium uppercase tracking-wider">
        Your account
      </p>

      <NavLink
        href={profileHref ?? '/citizen'}
        onClick={onNavigate}
        className={ITEM_CLASS}
      >
        {profileHref ? 'Your Profile' : 'Become a Citizen'}
      </NavLink>

      <AccountDisclosure label="Your Teams">
        <UserTeamsList variant="mobile" onNavigate={onNavigate} />
      </AccountDisclosure>

      <AccountDisclosure label="Your Projects & Proposals">
        <UserProjectsList variant="mobile" onNavigate={onNavigate} />
      </AccountDisclosure>

      {ACCOUNT_ACTIONS.map((action) => (
        <NavLink
          key={action.href}
          href={action.href}
          onClick={onNavigate}
          className={ITEM_CLASS}
        >
          {action.name}
        </NavLink>
      ))}
    </div>
  )
}

function AccountDisclosure({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Disclosure as="div" defaultOpen={false}>
      {({ open }) => (
        <>
          <Disclosure.Button
            className={`${ITEM_CLASS} flex items-center justify-between`}
          >
            {label}
            <ChevronRightIcon
              className={`${
                open ? 'rotate-90' : ''
              } h-5 w-5 transition-transform duration-150 text-white`}
              aria-hidden="true"
            />
          </Disclosure.Button>
          <Disclosure.Panel as="ul" className="pl-8">
            {children}
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}
