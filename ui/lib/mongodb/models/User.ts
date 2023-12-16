import mongoose, { Document, Schema } from 'mongoose'

export interface User {
  address: string
  nonce: string
  subscribed: boolean
}

export interface UserModel extends User, Document {}

const UserSchema: Schema = new Schema(
  {
    address: { type: String, required: false },
    nonce: { type: String, required: false },
    subscribed: { type: Boolean, required: false },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

export default mongoose.models.User ||
  mongoose.model<UserModel>('User', UserSchema)
