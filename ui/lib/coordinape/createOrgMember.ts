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
    const res = await graphQLClient.request(
      createOrgMembersMutation,
      {...input, circle_id: circleId}
    ) as any;
    if (!res.createUsers) throw new Error("Failed to add user to circle");
    const [user] = res.createUsers;
    return {
      user_id: user.id,
      profile_id: user.UserResponse.profile.id
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
}
