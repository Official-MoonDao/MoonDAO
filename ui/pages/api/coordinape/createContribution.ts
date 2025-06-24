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

    // Enhanced validation
    if (!description || description.trim().length === 0) {
      return res.status(400).json({ error: "Description is required" });
    }

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    let user_id, profile_id;
    try {
      const coordinapeUser = await getUserId(address);
      user_id = coordinapeUser.user_id;
      profile_id = coordinapeUser.profile_id;
    } catch (userError: any) {
      return res.status(500).json({ error: `Failed to get or create user: ${userError.message}` });
    }

    try {
      const created = await createContribution({
        user_id, profile_id, description
      });
      return res.json(created);
    } catch (contributionError: any) {
      return res.status(500).json({ error: `Failed to create contribution: ${contributionError.message}` });
    }

  } catch (error: any) {
    return res.status(500).json({ error: `Unexpected error: ${error.message}` });
  }
}

export default withMiddleware(handler, authMiddleware);
