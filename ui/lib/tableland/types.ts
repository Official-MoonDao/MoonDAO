export type DistributionVote = {
  /**
   * Tableland auto-increment primary key for the row. Always present on
   * rows read back via `queryTable`; optional in the type because some
   * call sites construct `DistributionVote`-shaped objects without going
   * through Tableland (e.g. unit-test fixtures). Numeric on the wire,
   * but treat as a `number | string` because gateways occasionally
   * stringify it — convert via `Number(...)` before comparing.
   */
  id?: number | string
  address: string
  vote: { [key: string]: number }
  citizenId?: number
  citizenName?: string
}
