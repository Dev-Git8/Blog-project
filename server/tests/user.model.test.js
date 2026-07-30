import { describe, it, expect } from 'vitest'
import { User } from '../src/models/User.js'
import { sanitizeUser } from '../src/lib/sanitizeUser.js'
import { makeUser } from './factories.js'

describe('User model', () => {
  it('hashes the password and never stores it in plain text', async () => {
    const user = await makeUser({ password: 'correct horse battery' })
    expect(user.passwordHash).not.toContain('correct horse')
    expect(await user.comparePassword('correct horse battery')).toBe(true)
    expect(await user.comparePassword('wrong')).toBe(false)
  })

  it('lowercases username and email', async () => {
    const user = await makeUser({ username: 'MixedCase', email: 'Me@Example.COM' })
    expect(user.username).toBe('mixedcase')
    expect(user.email).toBe('me@example.com')
  })

  it('rejects a duplicate email', async () => {
    await makeUser({ email: 'dupe@example.com', username: 'one' })
    await expect(makeUser({ email: 'dupe@example.com', username: 'two' })).rejects.toThrow()
  })

  it('rejects a duplicate username', async () => {
    await makeUser({ username: 'taken', email: 'a@example.com' })
    await expect(makeUser({ username: 'taken', email: 'b@example.com' })).rejects.toThrow()
  })

  it('rejects an invalid username', async () => {
    await expect(makeUser({ username: 'no spaces!' })).rejects.toThrow()
  })

  it('defaults role to user and isBanned to false', async () => {
    const user = await makeUser()
    expect(user.role).toBe('user')
    expect(user.isBanned).toBe(false)
  })

  it('sanitizeUser exposes no secrets', async () => {
    const user = await makeUser({ email: 'secret@example.com' })
    const safe = sanitizeUser(user)
    expect(safe).toHaveProperty('username')
    expect(safe).toHaveProperty('role')
    expect(safe).not.toHaveProperty('passwordHash')
    expect(safe).not.toHaveProperty('email')
    expect(safe).not.toHaveProperty('_id')
  })
})
