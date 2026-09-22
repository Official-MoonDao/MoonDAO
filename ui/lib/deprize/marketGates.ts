import { MarketStage } from './constants'

export function marketAcceptsBets(m: {
  bettingOpen: boolean
  mintBound: boolean
  mintConfigured: boolean
  tradingHalted: boolean
  stage?: MarketStage
}): boolean {
  return (
    !!m.bettingOpen &&
    !!m.mintBound &&
    !!m.mintConfigured &&
    !m.tradingHalted &&
    m.stage === MarketStage.Running
  )
}
