import mongoose, { Document, Schema } from 'mongoose'

enum EntryType {
  REGULAR = 'REGULAR',
  MAIL = 'MAIL',
  REFERRAL = 'REFERRAL',
}

export interface Nft {
  userId: string
  tokenId: string
  name: string
  email: string
  address: string
  entryType?: EntryType
}

export interface NftModel extends Nft, Document {}

const NftSchema: Schema = new Schema(
  {
    userId: { type: String, required: false },
    tokenId: { type: String, required: false },
    name: { type: String, required: false },
    email: { type: String, required: false },
    address: { type: String, required: false },
    entryType: {
      type: String,
      enum: ['REGULAR', 'MAIL', 'REFERRAL'],
      default: 'REGULAR',
      required: false,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

export default mongoose.models.Nft || mongoose.model<NftModel>('Nft', NftSchema)
