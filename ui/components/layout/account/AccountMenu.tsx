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
  'block mx-1.5 rounded-sm px-3 py-2 text-[13px] text-white/70 hover:bg-white/[0.04] hover:text-white'

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

  const { citizen, isExpired } = useContext(CitizenContext)
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

  // Signed out, this is the bar's primary call to action. Sign in is the
  // outline control for people who already belong; Join is solid gold so the
  // two are not a matched pair.
  if (!isSignedIn) {
    return (
      <NavLink
        href="/join"
        className="whitespace-nowrap rounded-full bg-moon-gold px-4 py-1.5 text-[13px] font-semibold text-[#1c1408] transition duration-150 hover:brightness-105"
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
          className="absolute top-full right-0 z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-md border border-white/[0.08] bg-[#0b1020] py-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
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
            // A lapsed subscription leaves `citizen` unset, but sending that
            // wallet to the mint flow would be wrong — it already holds the
            // token and needs the renewal prompt that /dashboard raises.
            <NavLink
              href={isExpired ? '/dashboard' : '/citizen'}
              className={ITEM_CLASS}
              onClick={() => setOpen(false)}
            >
              {isExpired ? 'Renew Citizenship' : 'Become a Citizen'}
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
