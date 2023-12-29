import mongoose, { Document, Schema } from 'mongoose'

export interface User {
  address: string
  name: string
  email: string
}

export interface UserModel extends User, Document {}

const UserSchema: Schema = new Schema(
  {
    address: { type: String, required: false },
    name: { type: String, required: false },
    email: { type: String, required: false },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

export default mongoose.models.User ||
  mongoose.model<UserModel>('User', UserSchema)
