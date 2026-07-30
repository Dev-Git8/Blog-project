import { User } from '../src/models/User.js'

let counter = 0

export async function makeUser(overrides = {}) {
  counter += 1
  const { password = 'password123', ...rest } = overrides
  return User.create({
    username: `user${counter}`,
    email: `user${counter}@example.com`,
    passwordHash: await User.hashPassword(password),
    displayName: `User ${counter}`,
    ...rest,
  })
}
