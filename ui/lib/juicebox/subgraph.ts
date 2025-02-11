export function projectQuery(projectId: number) {
  return `
     query {
          projects(where: {projectId: ${projectId}}) {
            id
            projectId
            handle
            createdAt
            volume
            trendingScore
            paymentsCount
            trendingPaymentsCount
            trendingVolume
            createdWithinTrendingWindow
          }
        }
  `
}
