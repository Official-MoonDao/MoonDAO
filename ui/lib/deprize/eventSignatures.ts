export const BET_EVENT_SIGNATURE =
  'event Bet(uint256 indexed deprizeId, address indexed bettor, uint256 outcomeIndex, uint256 outcomeTokenAmount, uint256 cost, uint256 slice)' as const
export const TRADE_EVENT_SIGNATURE =
  'event AMMOutcomeTokenTrade(address indexed transactor, int256[] outcomeTokenAmounts, int256 outcomeTokenNetCost, uint256 marketFees)' as const
export const FUNDING_EVENT_SIGNATURE = 'event AMMFundingChanged(int256 fundingChange)' as const
