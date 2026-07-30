import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().trim().max(160, 'At most 160 characters').optional(),
})

export const updatePostSchema = z
  .object({
    title: z.string().trim().max(160, 'At most 160 characters').optional(),
    excerpt: z.string().trim().max(280, 'At most 280 characters').optional(),
    coverImageUrl: z.string().url('Must be a url').nullable().optional(),
    content: z.object({ blocks: z.array(z.any()) }).passthrough().optional(),
    tags: z.array(z.string().trim().toLowerCase().max(24)).max(5, 'At most 5 tags').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  tag: z.string().trim().toLowerCase().optional(),
  author: z.string().trim().toLowerCase().optional(),
})
