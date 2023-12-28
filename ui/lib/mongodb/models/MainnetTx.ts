import mongoose, { Document, Schema } from 'mongoose'

type State = 'PENDING' | 'MINTED' | 'ERROR'

export interface MainnetTx {
  address: string
  state: State
  name: string
  email: string
}

export interface MainnetTxModel extends MainnetTx, Document {}

const MainnetTxSchema: Schema = new Schema(
  {
    address: { type: String, required: true },
    state: {
      type: String,
      enum: ['PENDING', 'MINTED', 'ERROR'],
      required: true,
    },
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

export default mongoose.models.MainnetTx ||
  mongoose.model<MainnetTxModel>('MainnetTx', MainnetTxSchema)
