import { usePrivy } from '@privy-io/react-auth'
import { ChevronDownIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { useContext, useEffect, useRef, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { ACCOUNT_ACTIONS } from '@/lib/navigation/nav-config'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import IPFSRenderer from '../IPFSRenderer'
import { NavLink } from '../NavLink'
import { UserProjectsList } from './UserProjectsList'
import { UserTeamsList } from './UserTeamsList'

const SECTION_LABEL =
  'px-4 py-2 mx-2 text-xs text-gray-400 font-medium uppercase tracking-wider'
const ITEM_CLASS =
  'block px-4 py-2 mx-2 text-sm rounded-lg text-gray-300 hover:text-white hover:bg-purple-500/20 transition-all duration-200'

/**
 * Everything that belongs to the signed-in user: their profile, their teams,
 * their projects, and the two actions that create more of either.
 *
 * These used to be scattered through the public nav — "Your Profile" inside a
 * Citizens menu, "Your Teams" below Jobs and Marketplace — where a logged-out
 * visitor saw the headings for them and a logged-in one had to hunt. Gathering
 * them behind the avatar also keeps the on-chain hat scans that back the two
 * lists out of the public bar; they only run once this menu is opened.
 */
export default function AccountMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { citizen } = useContext(CitizenContext)
  const account = useActiveAccount()
  const { authenticated } = usePrivy()

  const isSignedIn = authenticated || !!account?.address

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Signed out, this is the bar's primary call to action: Sign in serves people
  // who already belong, Join is how anyone new gets in.
  //
  // Matching Sign in exactly (the previous approach) made them a matched pair,
  // and a pair has no primary. Worse, `gradient-2` is #425eeb -> #6d3f79, which
  // is the same blue-to-purple as the navbar behind it, so neither pill had much
  // to push against.
  //
  // Hierarchy comes from weight, width and light rather than size: the height
  // and text size still match Sign in so the two stay aligned, but Join is
  // bolder, wider, ringed to cut its edge out of the dark bar, and carries a
  // blue glow that the flat Sign in pill does not.
  if (!isSignedIn) {
    return (
      <NavLink
        href="/join"
        className="gradient-2 whitespace-nowrap rounded-full px-5 py-1 text-[12px] md:text-[18px] font-semibold text-white ring-1 ring-white/30 shadow-[0_0_18px_rgba(66,94,235,0.55)] hover:shadow-[0_0_26px_rgba(66,94,235,0.85)] hover:brightness-110 transition duration-150"
      >
        Join
      </NavLink>
    )
  }

  const citizenName = citizen?.metadata?.name
  const profileHref = citizenName
    ? `/citizen/${generatePrettyLinkWithId(citizenName, citizen.metadata.id)}`
    : null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-1 rounded-full p-0.5 text-gray-300 hover:text-white transition-colors duration-200"
      >
        {citizen?.metadata?.image ? (
          <span className="rounded-full w-[40px] h-[40px] overflow-hidden flex items-center justify-center animate-fadeIn">
            <IPFSRenderer
              className="object-cover"
              src={citizen.metadata.image}
              width={40}
              height={40}
              alt=""
            />
          </span>
        ) : (
          <UserCircleIcon className="w-[34px] h-[34px]" />
        )}
        <ChevronDownIcon
          className={`w-3 h-3 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-2 z-50 w-64 max-h-[70vh] overflow-y-auto bg-gradient-to-br from-gray-900/98 via-blue-900/95 to-purple-900/90 backdrop-blur-xl border border-white/30 shadow-2xl py-2 rounded-xl"
        >
          {profileHref ? (
            <NavLink
              href={profileHref}
              className={ITEM_CLASS}
              onClick={() => setOpen(false)}
            >
              Your Profile
            </NavLink>
          ) : (
            <NavLink
              href="/citizen"
              className={ITEM_CLASS}
              onClick={() => setOpen(false)}
            >
              Become a Citizen
            </NavLink>
          )}

          <div className={SECTION_LABEL}>Your Teams</div>
          <UserTeamsList variant="desktop" onNavigate={() => setOpen(false)} />

          <div className={SECTION_LABEL}>Your Projects &amp; Proposals</div>
          <UserProjectsList variant="desktop" onNavigate={() => setOpen(false)} />

          <div className="my-2 border-t border-white/10" />

          {ACCOUNT_ACTIONS.map((action) => (
            <NavLink
              key={action.href}
              href={action.href}
              className={ITEM_CLASS}
              onClick={() => setOpen(false)}
            >
              {action.name}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
