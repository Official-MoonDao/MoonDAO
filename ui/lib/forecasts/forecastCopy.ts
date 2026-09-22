/**
 * Plain-language lexicon for the forecast panel and the callers list.
 * Scoring stays Brier in the math modules; this object never says so.
 */
export const FORECAST_COPY = {
  panelIntro:
    'Back one with ETH where betting is allowed. Citizens can also predict a single competitor, weighted by voting power.',
  restrictedNote: "Betting isn't available in your region — you can still make a prediction.",
  singlePick: 'Picking one competitor means the others are treated as not winning.',
  daoPending: (min: number, have: number) =>
    `The DAO number shows once ${min} Citizens have predicted (${have} so far).`,
  callersHeading: 'Who predicted',
  callersEmpty: 'Nobody has predicted this one yet.',
  callersCount: (n: number) => (n === 1 ? '1 person' : `${n} people`),
  votingPower: 'voting power',
  predictThis: 'Predict this',
  predicted: 'Predicted',
  backedWithEth: 'Backed with ETH',
}
