// Deep link into Moon Base Zero with a project pre-selected.
// Shares the index page component; `/moonbase/[projectId]` is read there.
// Re-exports the index's server gate too, so this route is hidden on the public
// production site exactly like `/moonbase` (see const/flags).
export { default, getServerSideProps } from './index'
