import { beforeAll, afterAll, afterEach } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'test-secret-not-used-in-production'
  process.env.CLIENT_ORIGIN ??= 'http://localhost:5173'
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  // Build the unique indexes the models declare; without this, duplicate-key
  // tests pass silently against an unindexed collection.
  await mongoose.connection.asPromise()
  for (const model of Object.values(mongoose.models)) {
    await model.syncIndexes()
  }
})

afterEach(async () => {
  const { collections } = mongoose.connection
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})))
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod?.stop()
})
