import { GraphQLClient } from "graphql-request"

const endpoint = "https://coordinape-prod.hasura.app/v1/graphql"
const apiKey = process.env.COORDINAPE_API_KEY

if (!apiKey) {
  console.error("COORDINAPE_API_KEY environment variable is not set");
}

export const graphQLClient = apiKey ? new GraphQLClient(endpoint, {
  headers: {
    "Authorization": `Bearer ${apiKey}`,
  },
}) : undefined
