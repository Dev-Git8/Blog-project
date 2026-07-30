import { z } from 'zod'

// Zod strips unknown keys by default, which is precisely what makes `role`
// unreachable through this endpoint.
export const updateMeSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Cannot be empty')
      .max(60, 'At most 60 characters')
      .optional(),
    bio: z.string().trim().max(280, 'At most 280 characters').optional(),
    avatarUrl: z.string().url('Must be a url').nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })

export const usernameParamSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(20),
})
