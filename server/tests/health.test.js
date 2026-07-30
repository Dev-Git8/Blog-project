import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

describe('server skeleton', () => {
  it('answers the health check', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('returns the standard error shape for an unknown api route', async () => {
    const res = await request(createApp()).get('/api/definitely-not-real')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    })
  })
})
