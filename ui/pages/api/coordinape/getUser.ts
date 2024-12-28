import { NextApiRequest, NextApiResponse } from "next";
import { getUserId } from "@/lib/coordinape/getCoordinapeUser";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const id = await getUserId(req.query.address as string);
    res.json(id)
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export default handler;
