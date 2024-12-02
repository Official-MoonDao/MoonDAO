import { gql, GraphQLClient } from "graphql-request"

const endpoint = "https://coordinape-prod.hasura.app/v1/graphql"
const apiKey = process.env.COORDINAPE_API_KEY

const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    "Authorization": `Bearer ${apiKey}`,
  },
})

const userIdByAddressQuery = gql`
  query UserIdQuery($address: String!) {
    profiles(where: {address: {_ilike: $address}}) {
      id
      users {
        id
      }
    }
  }
`

interface UserIdResponse {
  profiles: {
    id: number
    users: {
      id: number
    }[]
  }[]
}

// mutation createContribution {
//   insert_contributions_one(
//     object: {user_id: 301267, profile_id: 4062325, description: "im sniffwww2222"}
//   ) {
//     id
//     description
//     created_at
//     user_id
//     circle_id
//   }
// }

export type CoordinapeUser = {
  user_id: number;
  profile_id: number;
}

export async function getUserId(
  address: string | undefined,
): Promise<CoordinapeUser | undefined> {
  if (!apiKey) {
    throw Error("process.env.COORDINAPE_API_KEY not set!")
  }
  if (!address) {
    return undefined
  }

  try {
    const variables = { address }
    const data = await graphQLClient.request<UserIdResponse>(
      userIdByAddressQuery,
      variables
    )
    const profile = data.profiles[0];
    if (!profile) throw Error("address not found in circle");
    return { profile_id: profile.id, user_id: profile.users[0].id }
  } catch (error) {
    throw error
  }
}
