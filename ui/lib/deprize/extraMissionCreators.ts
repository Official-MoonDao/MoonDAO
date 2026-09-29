/**
 * MissionCreators outside the app-wide deployment. Sepolia DePrize fixtures
 * register on a dedicated creator, so a Juicebox project id will not appear
 * in the public mission table.
 */
export const EXTRA_MISSION_CREATORS: Partial<Record<string, readonly string[]>> = {
  sepolia: ['0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1'],
}
