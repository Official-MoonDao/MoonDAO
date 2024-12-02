import { NextApiRequest, NextApiResponse } from "next";
import { CoordinapeContribution, createContribution } from "@/lib/coordinape";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { user_id, profile_id, description } = req.body as CoordinapeContribution;
    if (!user_id || !profile_id || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await createContribution({
      user_id, profile_id, description
    });
    return res.json(created);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export default handler;
