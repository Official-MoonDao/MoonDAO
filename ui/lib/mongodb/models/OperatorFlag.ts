import mongoose, { Document, Schema } from 'mongoose'

// Generic key/value store for operator-controlled toggles (e.g. forcing the
// retroactive rewards cycle on/off ahead of the date-based default in
// `isRewardsCycle`).
export interface OperatorFlag {
  key: string
  enabled: boolean
  setBy?: string
  note?: string
  expiresAt?: Date
}

export interface OperatorFlagModel extends OperatorFlag, Document {}

const OperatorFlagSchema: Schema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, required: true, default: false },
    setBy: { type: String, required: false },
    note: { type: String, required: false },
    expiresAt: { type: Date, required: false },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

export default mongoose.models.OperatorFlag ||
  mongoose.model<OperatorFlagModel>('OperatorFlag', OperatorFlagSchema)
