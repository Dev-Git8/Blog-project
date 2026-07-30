import { z } from 'zod'

export const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'At least 3 characters')
    .max(20, 'At most 20 characters')
    .regex(/^[a-z0-9_-]+$/, 'Letters, numbers, hyphens and underscores only'),
  email: z.string().trim().toLowerCase().email('That does not look like an email'),
  password: z.string().min(8, 'At least 8 characters').max(200, 'Too long'),
  displayName: z.string().trim().max(60).optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email'),
  password: z.string().min(1, 'Enter your password'),
})
