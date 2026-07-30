import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { User } from '../src/models/User.js'
import { makeUser } from './factories.js'

const app = () => createApp()

const good = {
  username: 'nella',
  email: 'nella@example.com',
  password: 'password123',
}

describe('POST /api/auth/signup', () => {
  it('creates an account and sets an httpOnly cookie', async () => {
    const res = await request(app()).post('/api/auth/signup').send(good)
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ username: 'nella', role: 'user' })
    expect(res.body.user).not.toHaveProperty('passwordHash')

    const cookie = res.headers['set-cookie'].join(';')
    expect(cookie).toContain('token=')
    expect(cookie).toContain('HttpOnly')
  })

  it('rejects a duplicate email with 409', async () => {
    await request(app()).post('/api/auth/signup').send(good)
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ ...good, username: 'other' })
    expect(res.status).toBe(409)
    expect(res.body.error.fields).toHaveProperty('email')
  })

  it('rejects a duplicate username with 409', async () => {
    await request(app()).post('/api/auth/signup').send(good)
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ ...good, email: 'different@example.com' })
    expect(res.status).toBe(409)
    expect(res.body.error.fields).toHaveProperty('username')
  })

  it('rejects a short password with 422 and names the field', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ ...good, password: 'short' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(res.body.error.fields).toHaveProperty('password')
  })

  it('rejects an invalid username with 422', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ ...good, username: 'has spaces' })
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toHaveProperty('username')
  })
})

describe('POST /api/auth/login', () => {
  it('signs in with correct credentials', async () => {
    await makeUser({ username: 'zia', email: 'zia@example.com', password: 'password123' })
    const res = await request(app())
      .post('/api/auth/login')
      .send({ email: 'zia@example.com', password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.body.user.username).toBe('zia')
    expect(res.headers['set-cookie'].join(';')).toContain('token=')
  })

  it('is case-insensitive about the email', async () => {
    await makeUser({ email: 'zia@example.com', password: 'password123' })
    const res = await request(app())
      .post('/api/auth/login')
      .send({ email: 'ZIA@Example.com', password: 'password123' })
    expect(res.status).toBe(200)
  })

  it('gives the same generic 401 for a wrong password and an unknown email', async () => {
    await makeUser({ email: 'zia@example.com', password: 'password123' })
    const wrongPassword = await request(app())
      .post('/api/auth/login')
      .send({ email: 'zia@example.com', password: 'nope-nope-nope' })
    const unknownEmail = await request(app())
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' })

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    // No account-existence leak: the two responses must be indistinguishable.
    expect(wrongPassword.body).toEqual(unknownEmail.body)
  })
})

describe('GET /api/auth/me', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app()).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns the current user with a cookie', async () => {
    const agent = request.agent(app())
    await agent.post('/api/auth/signup').send(good)
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.user.username).toBe('nella')
  })

  it('returns 401 after logout', async () => {
    const agent = request.agent(app())
    await agent.post('/api/auth/signup').send(good)
    await agent.post('/api/auth/logout')
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 when the token names a user who no longer exists', async () => {
    const agent = request.agent(app())
    await agent.post('/api/auth/signup').send(good)
    await User.deleteMany({})
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
