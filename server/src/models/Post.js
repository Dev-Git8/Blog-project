import mongoose from 'mongoose'

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, trim: true, maxlength: 160, default: '' },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, trim: true, maxlength: 280, default: '' },
    // True once the author writes their own excerpt, which stops later content
    // edits from overwriting it.
    excerptManual: { type: Boolean, default: false },
    coverImageUrl: { type: String, default: null },
    content: { type: mongoose.Schema.Types.Mixed, default: () => ({ blocks: [] }) },
    tags: {
      type: [String],
      default: [],
      set: (tags) =>
        Array.isArray(tags)
          ? [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))]
          : [],
      validate: [
        { validator: (tags) => tags.length <= 5, message: 'At most 5 tags' },
        {
          validator: (tags) => tags.every((tag) => tag.length <= 24 && /^[a-z0-9-]+$/.test(tag)),
          message: 'Tags may use letters, numbers and hyphens, up to 24 characters',
        },
      ],
    },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

postSchema.index({ status: 1, publishedAt: -1 })
postSchema.index({ tags: 1, status: 1, publishedAt: -1 })
postSchema.index({ author: 1, status: 1, updatedAt: -1 })

export const Post = mongoose.model('Post', postSchema)
