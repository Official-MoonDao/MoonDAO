export const PROJECT_VOTE_FAILED = 4
export const PROJECT_TEMP_CHECK_FAILED = 3
export const PROJECT_PENDING = 1
export const PROJECT_ACTIVE = 2
export const PROJECT_ENDED = 0
// Author-withdrawn proposals. The ProjectTable contract exposes no
// row-delete, so "delete" is a soft-delete: the `active` column is set to
// this sentinel and every listing/detail surface filters it out.
export const PROJECT_WITHDRAWN = 5
