const TEXT_BLOCKS = new Set([
  'paragraph',
  'heading',
  'quote',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
])

const NON_TEXT_CONTENT_BLOCKS = new Set([
  'image',
  'videoEmbed',
  'references',
  'codeBlock',
  'table',
])

const blocksOf = (content) => (Array.isArray(content?.blocks) ? content.blocks : [])

const inlineText = (block) =>
  (Array.isArray(block?.content) ? block.content : [])
    .map((node) =>
      node?.type === 'link'
        ? (node.content ?? []).map((child) => child?.text ?? '').join('')
        : node?.text ?? '',
    )
    .join('')

export function deriveExcerpt(content, max = 280) {
  for (const block of blocksOf(content)) {
    if (!TEXT_BLOCKS.has(block?.type)) continue
    const text = inlineText(block).trim()
    if (text) return text.slice(0, max)
  }
  return ''
}

export function countTextLength(content) {
  let total = 0
  const walk = (blocks) => {
    for (const block of blocks ?? []) {
      total += inlineText(block).trim().length
      // A post that is only an image or a video is still a real post.
      if (NON_TEXT_CONTENT_BLOCKS.has(block?.type)) total += 1
      if (Array.isArray(block?.children)) walk(block.children)
    }
  }
  walk(blocksOf(content))
  return total
}
