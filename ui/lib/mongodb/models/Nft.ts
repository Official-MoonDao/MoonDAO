import mongoose, { Document, Schema } from 'mongoose'

export interface Nft {
  userId: string
  tokenId: string
  name: string
  email: string
}

export interface NftModel extends Nft, Document {}

const NftSchema: Schema = new Schema(
  {
    userId: { type: String, required: true },
    tokenId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

let returnModel
if (mongoose.models && mongoose.models.Nft) {
  returnModel = mongoose.models.Nft
} else {
  returnModel = mongoose.model<NftModel>('Nft', NftSchema)
}
export default returnModel
