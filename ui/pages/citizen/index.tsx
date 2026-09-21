import { useRouter } from 'next/router'
import { useCallback, useContext } from 'react'
import useRegionRestriction from '@/lib/geo/useRegionRestriction'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Head from '@/components/layout/Head'
import CreateCitizen from '@/components/onboarding/CreateCitizen'
import RegionRestrictedNotice from '@/components/onboarding/RegionRestrictedNotice'

export default function Join() {
  const { selectedChain } = useContext(ChainContextV5)
  const router = useRouter()

  // EU/EEA visitors may browse the site but cannot permanently store personal
  // data on chain (GDPR), so they don't get the citizen creation flow. We only
  // gate on a *confirmed* restricted country here -- if the geo lookup errors
  // out (timeout, flaky connection, etc.) we let the visitor through rather
  // than assuming they're EU/EEA, since that previously misclassified
  // non-EU/EEA visitors (e.g. Russia, which is not in EU_EEA_COUNTRIES) whose
  // requests to /api/geo/country failed as "restricted" and blocked them from
  // a flow that was never meant to apply to them. The GDPR gate is still
  // enforced authoritatively server-side (see enforceRegionNotRestricted) at
  // mint/image-generation time regardless of this client-side check, so
  // actual EU/EEA visitors are never able to complete the flow even if their
  // geo lookup happens to error out here.
  const { isRestricted, isLoading: isResolvingRegion } = useRegionRestriction()

  useChainDefault()

  // The /citizen route opens the citizen creation flow directly. The old
  // tier-selection card was an extra click, so every entry point now lands
  // straight in the wizard (sign-in is deferred until mint).
  const handleExitFlow = useCallback(
    (tier?: 'team' | 'citizen' | null) => {
      // The wizard calls this with a falsy value when the user closes it.
      if (!tier) {
        router.push('/')
      }
    },
    [router]
  )

  // A one-time magic-link invite (`?invite=<token>`) is verified server-side.
  // 100% off invites become a sponsored mint after that check. Partial
  // discounts stay paid, so the token alone must not mark the page as free.
  const inviteToken = typeof router.query.invite === 'string' ? router.query.invite : undefined
  const freeMint = router.query.freeMint === 'true'

  return (
    <>
      <Head
        title={'Become a Citizen'}
        description={
          'The Space Acceleration Network is an onchain startup society focused on building a permanent settlement on the Moon and beyond.'
        }
        image="https://ipfs.io/ipfs/QmUG1fcYnnzkhTFwSvMAy1gcFcq99VCk3Eps1L9g6qkt49"
      />
      {/* Wait until geo resolves so we never flash the creation flow to a
          restricted visitor. */}
      {isResolvingRegion ? null : isRestricted ? (
        <RegionRestrictedNotice type="citizen" />
      ) : (
        <CreateCitizen
          selectedChain={selectedChain}
          setSelectedTier={handleExitFlow}
          freeMintProp={freeMint}
          inviteToken={inviteToken}
        />
      )}
    </>
  )
}
