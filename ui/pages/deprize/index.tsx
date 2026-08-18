import { useContext } from 'react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import DePrizeComingSoon from '@/components/deprize/DePrizeComingSoon'
import DePrizeIndexContent from '@/components/deprize/DePrizeIndexContent'

export default function DePrizeIndexPage() {
  const { selectedChain } = useContext(ChainContextV5)
  // AUDIT[plan Phase 6.3]: do NOT remove this gate until
  // DEPRIZE_REGISTRY_ADDRESSES.arbitrum (and mint/redeem/fee-router) are
  // populated after Phase 5 verify. Flipping it early shows an empty/broken list.
  if (getChainSlug(selectedChain) === 'arbitrum') {
    return <DePrizeComingSoon />
  }
  return <DePrizeIndexContent />
}
