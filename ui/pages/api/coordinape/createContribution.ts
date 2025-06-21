import { NextApiRequest, NextApiResponse } from "next";
import { createContribution } from "@/lib/coordinape/createCoordinapeContribution";
import { getUserId } from "@/lib/coordinape/getCoordinapeUser";
import withMiddleware from "middleware/withMiddleware";
import { authMiddleware } from "middleware/authMiddleware";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { description, address } = req.body;

    // Enhanced validation and debugging
    if (!description || description.trim().length === 0) {
      console.error("CreateContribution: Missing or empty description");
      return res.status(400).json({ error: "Description is required" });
    }

    if (!address) {
      console.error("CreateContribution: Missing address");
      return res.status(400).json({ error: "Address is required" });
    }

    console.log("CreateContribution: Starting process for address:", address.slice(0, 6) + "..." + address.slice(-4));

    let user_id, profile_id;
    try {
      const coordinapeUser = await getUserId(address);
      user_id = coordinapeUser.user_id;
      profile_id = coordinapeUser.profile_id;
      console.log("CreateContribution: Got user_id and profile_id successfully");
    } catch (userError: any) {
      console.error("CreateContribution: Error getting user ID:", userError.message);
      return res.status(500).json({ error: `Failed to get or create user: ${userError.message}` });
    }

    try {
      const created = await createContribution({
        user_id, profile_id, description
      });
      console.log("CreateContribution: Contribution created successfully");
      return res.json(created);
    } catch (contributionError: any) {
      console.error("CreateContribution: Error creating contribution:", contributionError.message);
      return res.status(500).json({ error: `Failed to create contribution: ${contributionError.message}` });
    }

  } catch (error: any) {
    console.error("CreateContribution: Unexpected error:", error);
    return res.status(500).json({ error: `Unexpected error: ${error.message}` });
  }
}

export default withMiddleware(handler, authMiddleware);
