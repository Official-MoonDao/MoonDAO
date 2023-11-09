import mongoose, { Document, Schema } from 'mongoose'

export interface User {
  name: string
  email: string
}

export interface UserModel extends User, Document {}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

let returnModel
if (mongoose.models && mongoose.models.User) {
  returnModel = mongoose.models.User
} else {
  returnModel = mongoose.model<UserModel>('User', UserSchema)
}
export default returnModel
