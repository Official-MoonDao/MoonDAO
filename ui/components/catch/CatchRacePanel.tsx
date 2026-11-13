/**
 * The real-race panel with live market odds: reads the site's chain context
 * and hands the reading to the view. Kept apart from the view so the panel can
 * also be shown, forecast only, where there is no chain context.
 */
import { useContext } from 'react'
import { useDePrizeGoalOdds } from '@/lib/deprize/useDePrizeGoalOdds'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import CatchRaceView, { CATCH_RACE_GOAL_ID, type LiveOdds } from './CatchRaceView'

export default function CatchRacePanel(props: { onMakeYourCall: () => void; compact?: boolean }) {
  const { selectedChain } = useContext(ChainContextV5)
  const live = useDePrizeGoalOdds(selectedChain, CATCH_RACE_GOAL_ID)
  return <CatchRaceView live={live as LiveOdds} {...props} />
}
