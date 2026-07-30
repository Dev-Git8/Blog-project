import mongoose from 'mongoose'
import { connectDb } from '../src/lib/db.js'
import { User } from '../src/models/User.js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('usage: npm run make-admin -- <email>')
  process.exit(1)
}

await connectDb()
const user = await User.findOneAndUpdate(
  { email },
  { role: 'admin' },
  { new: true },
)
if (!user) {
  console.error(`no account found for ${email}`)
  await mongoose.disconnect()
  process.exit(1)
}
console.log(`${user.username} is now an admin`)
await mongoose.disconnect()
