import mongoose, { Document, Schema } from 'mongoose';


export interface Nonce {
  address: string
  nonce: string
  subscribed: string
}

export interface NonceModel extends Nonce, Document {}

const NonceSchema: Schema = new Schema(
  {
    address: { type: String, required: false },
    subscribed: {type: String, required: false },
    nonce: { type: String, required: false },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

export default mongoose.models.Nonce ||
  mongoose.model<NonceModel>('Nonce', NonceSchema)