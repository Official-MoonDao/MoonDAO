import { gql } from "graphql-request";
import { graphQLClient } from "./client";
import { CoordinapeUser, UserIdResponse } from "./types";
import { createOrgMembers } from "./createOrgMember";

const userIdByAddressQuery = gql`
  query UserIdQuery($address: String!) {
    profiles(where: {address: {_ilike: $address}}) {
      id
      users {
        id
      }
    }
  }
`;

export async function getUserId(
  address: string | undefined,
): Promise<CoordinapeUser> {
  if (!graphQLClient) {
    throw new Error("COORDINAPE_API_KEY environment variable is not set");
  }

  if (!address) {
    throw new Error("No address found in coordinape user request");
  }

  try {
    console.log("getUserId: Starting lookup for address:", address.slice(0, 6) + "..." + address.slice(-4));
    const variables = { address }
    let profile_id;
    let user_id;
    const data = await graphQLClient.request<UserIdResponse>(
      userIdByAddressQuery,
      variables
    )
    console.log("getUserId: Query result:", { profilesFound: data.profiles.length });
    
    const profile = data.profiles[0];
    if (!profile || profile.users?.length === 0) {
      console.log("getUserId: User not found, creating new org member");
      // create user with mutation
      ({user_id, profile_id} = await createOrgMembers({
        address,
        name: address.slice(0, 6) + '...' + address.slice(-4)
      }));
      console.log("getUserId: Created new user with ID:", user_id);
    } else {
      profile_id = profile.id
      user_id = profile.users[0].id;
      console.log("getUserId: Found existing user with ID:", user_id);
    }
    return { profile_id, user_id }
  } catch (error: any) {
    console.error("getUserId: Error occurred:", error.message);
    if (error.message.includes('COORDINAPE_API_KEY')) {
      throw new Error("Coordinape API is not properly configured");
    } else if (error.message.includes('Failed to add user to circle')) {
      throw new Error("Unable to add you to the Coordinape circle. Please contact support.");
    } else if (error.response?.errors) {
      console.error("getUserId: GraphQL errors:", error.response.errors);
      throw new Error("Database query failed. Please try again.");
    }
    throw error;
  }
}
