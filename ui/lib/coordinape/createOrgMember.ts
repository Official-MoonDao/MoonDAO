import { gql } from "graphql-request";
import { graphQLClient } from "./client";

const circleId = process.env.NEXT_PUBLIC_ENV === 'prod' ? 29837 : 31596;

const createOrgMembersMutation = gql`
  mutation createUsers($address: String!, $name: String!, $circle_id: Int!) {
    createUsers(
      payload: {
        circle_id: $circle_id,
        users: {
          address: $address,
          name: $name,
          entrance: ""
        }
      }
    ) {
      id
      UserResponse {
        profile {
          id
        }
      }
    }
  }
`;

export async function createOrgMembers(
  input: { address: string, name: string }
) {
  if (!graphQLClient) {
    throw new Error("COORDINAPE_API_KEY environment variable is not set")
  }

  try {
    console.log("createOrgMembers: Creating user for circle:", circleId);
    const res = await graphQLClient.request(
      createOrgMembersMutation,
      {...input, circle_id: circleId}
    ) as any;
    
    console.log("createOrgMembers: Response:", JSON.stringify(res, null, 2));
    
    if (!res.createUsers) {
      console.error("createOrgMembers: No createUsers in response");
      throw new Error("Failed to add user to circle");
    }
    
    const [user] = res.createUsers;
    if (!user || !user.UserResponse?.profile?.id) {
      console.error("createOrgMembers: Invalid user structure in response");
      throw new Error("Failed to get user profile information");
    }
    
    const result = {
      user_id: user.id,
      profile_id: user.UserResponse.profile.id
    };
    console.log("createOrgMembers: Successfully created user:", result);
    return result;
  } catch (error: any) {
    console.error("createOrgMembers: Error:", error);
    if (error.response?.errors) {
      console.error("createOrgMembers: GraphQL errors:", error.response.errors);
      // Check for specific Coordinape errors
      const errors = error.response.errors;
      if (errors.some((e: any) => e.message.includes('circle'))) {
        throw new Error("Unable to access the Coordinape circle. Please contact support.");
      } else if (errors.some((e: any) => e.message.includes('permission'))) {
        throw new Error("Insufficient permissions to create user in Coordinape.");
      }
    }
    throw error;
  }
}
