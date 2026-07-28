import { useContext } from 'react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import DePrizeComingSoon from '@/components/deprize/DePrizeComingSoon'
import DePrizeIndexContent from '@/components/deprize/DePrizeIndexContent'

export default function DePrizeIndexPage() {
  const { selectedChain } = useContext(ChainContextV5)
  if (getChainSlug(selectedChain) === 'arbitrum') {
    return <DePrizeComingSoon />
  }
  return <DePrizeIndexContent />
}
