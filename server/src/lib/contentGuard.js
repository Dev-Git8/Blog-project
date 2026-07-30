import { validationError } from './httpError.js'
import { parseVideoUrl } from './video.js'

const MAX_BLOCKS = 500
const MAX_DEPTH = 4

const fail = (message) => {
  throw validationError(message, { content: message })
}

const isHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

// References are stored as a JSON string in block props because BlockNote props
// must be primitives. Parse defensively — this value came from a client.
const parseItems = (raw) => {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function assertValidContent(content) {
  const malformed =
    !content ||
    typeof content !== 'object' ||
    Array.isArray(content) ||
    !Array.isArray(content.blocks)
  if (malformed) fail('Post content must be an object with a blocks array')

  let count = 0

  const walk = (blocks, depth) => {
    if (depth > MAX_DEPTH) fail('Post content is nested too deeply')

    for (const block of blocks) {
      count += 1
      if (count > MAX_BLOCKS) fail('This post has too many blocks (maximum 500)')
      if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
        fail('Post content contains a malformed block')
      }

      if (block.type === 'videoEmbed' && !parseVideoUrl(block.props?.url)) {
        fail('Video embeds must be a YouTube or Vimeo link')
      }

      if (block.type === 'image' && block.props?.url && !isHttpUrl(block.props.url)) {
        fail('Image blocks must use an http or https url')
      }

      if (block.type === 'references') {
        const items = parseItems(block.props?.items)
        if (!items) fail('The references block is malformed')
        for (const item of items) {
          if (!isHttpUrl(item?.url)) fail('Every reference must be an http or https url')
        }
      }

      if (Array.isArray(block.children) && block.children.length) {
        walk(block.children, depth + 1)
      }
    }
  }

  walk(content.blocks, 1)
}
