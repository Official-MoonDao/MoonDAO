import { NextApiRequest, NextApiResponse } from "next";
import { createContribution } from "@/lib/coordinape/createCoordinapeContribution";
import { getUserId } from "@/lib/coordinape/getCoordinapeUser";
import withMiddleware from "middleware/withMiddleware";
import { privyAuth } from "middleware/privyAuth";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { description, address } = req.body;
    const { user_id, profile_id } = await getUserId(address);
    const created = await createContribution({
      user_id, profile_id, description
    });
    return res.json(created);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export default withMiddleware(handler, privyAuth);
