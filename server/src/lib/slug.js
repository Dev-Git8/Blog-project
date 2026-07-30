import crypto from 'node:crypto'

export function slugify(title) {
  const base = String(title ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return base || 'post'
}

// Slugs are permanent, so collisions get a random suffix rather than a counter —
// a counter would leak how many similarly titled posts exist.
export async function uniqueSlug(title, PostModel) {
  const base = slugify(title)
  if (!(await PostModel.exists({ slug: base }))) return base

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${crypto.randomBytes(2).toString('hex')}`
    if (!(await PostModel.exists({ slug: candidate }))) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}
