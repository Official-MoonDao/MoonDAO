import { NAV_GROUPS } from './nav-config'

/**
 * The groups rendered by `TopNavBar` and `MobileSidebar`.
 *
 * This used to build the tree inline and vary it by citizenship — a Dashboard
 * item that became Join, a Citizens menu whose first two entries swapped
 * depending on whether you held a Citizen NFT. Everything per-user now lives
 * in the account menu behind the avatar (`AccountMenu`), so the public nav is
 * the same for everyone and is plain data.
 */
export default function useNavigation() {
  return NAV_GROUPS
}
