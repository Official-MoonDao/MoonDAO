import mongoose, { Document, Schema } from "mongoose";

export interface Nft {
  userId: string;
  address: string;
  instanceNumber: number;
  url: string;
}

export interface NftModel extends Nft, Document {}

const NftSchema: Schema = new Schema(
  {
    userId: { type: String, required: true },
    address: { type: String, required: true },
    instanceNumber: { type: Number, required: true },
    url: { type: String, required: true },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

export default mongoose.model<NftModel>("Nft", NftSchema);
