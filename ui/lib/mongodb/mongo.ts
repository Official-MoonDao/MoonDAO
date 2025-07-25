import mongoose from 'mongoose'
import { mongoConfig } from '../../const/config'

declare global {
  var mongooseCache: any // This must be a `var` and not a `let / const`
}

if (!mongoConfig.url) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  )
}

let cached = global.mongooseCache

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null }
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn
  }
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }
    cached.promise = mongoose
      .connect(mongoConfig.url, opts)
      .then((mongoose) => {
        return mongoose
      })
  }
  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default dbConnect
