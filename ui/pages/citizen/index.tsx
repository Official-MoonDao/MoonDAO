import { useRouter } from 'next/router'
import { useCallback, useContext } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Head from '@/components/layout/Head'
import CreateCitizen from '@/components/onboarding/CreateCitizen'

export default function Join() {
  const { selectedChain } = useContext(ChainContextV5)
  const router = useRouter()

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
    [router],
  )

  // A one-time magic-link invite (`?invite=<token>`) sponsors a free mint for
  // whoever redeems it; eligibility is verified server-side against the token.
  const inviteToken =
    typeof router.query.invite === 'string' ? router.query.invite : undefined
  const freeMint = router.query.freeMint === 'true' || Boolean(inviteToken)

  return (
    <>
      <Head
        title={'Become a Citizen'}
        description={
          'The Space Acceleration Network is an onchain startup society focused on building a permanent settlement on the Moon and beyond.'
        }
        image="https://ipfs.io/ipfs/QmUG1fcYnnzkhTFwSvMAy1gcFcq99VCk3Eps1L9g6qkt49"
      />
      <CreateCitizen
        selectedChain={selectedChain}
        setSelectedTier={handleExitFlow}
        freeMintProp={freeMint}
        inviteToken={inviteToken}
      />
    </>
  )
}
