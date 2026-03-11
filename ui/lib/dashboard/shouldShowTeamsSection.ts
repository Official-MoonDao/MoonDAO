/**
 * Determines whether the "Your Teams" section should be shown on the dashboard.
 * Shown when: user has at least one team, or teams are still loading.
 */
export function shouldShowTeamsSection(
  teamHats: unknown[] | undefined,
  isLoadingTeams: boolean
): boolean {
  return isLoadingTeams || (teamHats != null && teamHats.length > 0)
}
