/**
 * MissionCreators outside the app-wide deployment. DePrize prize pools register
 * on these creators, so their Juicebox project ids are not in the public
 * mission table. Arbitrum Touchdown (DePrize 2) is project 83, mission 1.
 */
export const EXTRA_MISSION_CREATORS: Partial<Record<string, readonly string[]>> = {
  arbitrum: [
    '0x87307f5D73c93B5b0a2e250194d62CD2D4BfEe3B',
    '0x6dB622369C46F9480915AE8394e6202C000D7CFb',
  ],
  sepolia: [
    '0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1',
    '0xe103fBE8a0A04d6664755aDa6D2da3D66d3c394a',
  ],
}
