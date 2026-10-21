/**
 * MissionCreators outside the app-wide deployment. DePrize prize pools register
 * on these creators, so their Juicebox project ids are not in the public
 * mission table. Arbitrum Touchdown (DePrize 2) is project 83, mission 1.
 */
export const EXTRA_MISSION_CREATORS: Partial<Record<string, readonly string[]>> = {
  arbitrum: ['0x87307f5D73c93B5b0a2e250194d62CD2D4BfEe3B'],
  sepolia: ['0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1'],
}
