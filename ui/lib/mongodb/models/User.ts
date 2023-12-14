import mongoose, { Document, Schema } from 'mongoose'

export interface User {
  address: string
  nonce: string
}

export interface UserModel extends User, Document {}

const UserSchema: Schema = new Schema(
  {
    address: { type: String, required: true },
    nonce: { type: String, required: true },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

export default mongoose.models.User ||
  mongoose.model<UserModel>('User', UserSchema)
