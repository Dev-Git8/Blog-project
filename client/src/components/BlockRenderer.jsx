import { Fragment } from 'react'
import { parseVideoUrl, embedUrl } from '../lib/video.js'

// Only these schemes may appear in an href. Everything else is dropped, which
// is what stops a javascript: url stored in a post from ever being clickable.
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

const safeHref = (value) => {
  try {
    return SAFE_SCHEMES.has(new URL(value, 'https://example.com').protocol) ? value : null
  } catch {
    return null
  }
}

const parseItems = (raw) => {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function InlineText({ node }) {
  const { bold, italic, underline, strike, code } = node.styles ?? {}
  let element = <>{node.text}</>
  if (code) {
    element = <code className="rounded bg-parchment px-1.5 py-0.5 text-[0.9em]">{element}</code>
  }
  if (strike) element = <s>{element}</s>
  if (underline) element = <u>{element}</u>
  if (italic) element = <em>{element}</em>
  if (bold) element = <strong>{element}</strong>
  return element
}

function Inline({ nodes }) {
  return (
    <>
      {(nodes ?? []).map((node, index) => {
        if (node?.type === 'link') {
          const href = safeHref(node.href)
          const label = <Inline nodes={node.content} />
          return href ? (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium underline decoration-mustard decoration-2 underline-offset-2"
            >
              {label}
            </a>
          ) : (
            <Fragment key={index}>{label}</Fragment>
          )
        }
        if (node?.type === 'text') return <InlineText key={index} node={node} />
        return null
      })}
    </>
  )
}

function PostImage({ props }) {
  const href = safeHref(props?.url)
  if (!href) return null
  return (
    <figure className="my-8">
      <img
        src={href}
        alt={props.name ?? props.caption ?? ''}
        className="w-full rounded-2xl border-2 border-ink"
        loading="lazy"
      />
      {props.caption ? (
        <figcaption className="mt-2 text-center text-sm italic">{props.caption}</figcaption>
      ) : null}
    </figure>
  )
}

function VideoEmbed({ props }) {
  const parsed = parseVideoUrl(props?.url)
  // An unrecognised provider renders nothing rather than an arbitrary iframe.
  if (!parsed) return null

  return (
    <figure className="my-8">
      <div className="aspect-video overflow-hidden rounded-2xl border-2 border-ink">
        <iframe
          src={embedUrl(parsed)}
          title={props.caption || 'Embedded video'}
          className="size-full"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      {props.caption ? (
        <figcaption className="mt-2 text-center text-sm italic">{props.caption}</figcaption>
      ) : null}
    </figure>
  )
}

function References({ props }) {
  const items = parseItems(props?.items).filter((item) => safeHref(item?.url))
  if (!items.length) return null

  return (
    <aside className="my-8 rounded-2xl border-2 border-ink bg-card p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest">{props.title || 'References'}</h2>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
        {items.map((item, index) => (
          <li key={index}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline decoration-mustard decoration-2 underline-offset-2"
            >
              {item.label || item.url}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function Block({ block }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="my-5">
          <Inline nodes={block.content} />
        </p>
      )

    // Post titles are the page's h1, so in-body headings start at h2.
    case 'heading': {
      const level = Math.min(Number(block.props?.level ?? 1) + 1, 6)
      const Tag = `h${level}`
      const size = level === 2 ? 'text-3xl' : level === 3 ? 'text-2xl' : 'text-xl'
      return (
        <Tag className={`display mt-10 mb-3 ${size}`}>
          <Inline nodes={block.content} />
        </Tag>
      )
    }

    case 'quote':
      return (
        <blockquote className="my-6 border-l-4 border-mustard pl-5 italic">
          <Inline nodes={block.content} />
        </blockquote>
      )

    case 'codeBlock':
      return (
        <pre className="my-6 overflow-x-auto rounded-2xl border-2 border-ink bg-ink p-4 text-sm text-parchment">
          <code>
            <Inline nodes={block.content} />
          </code>
        </pre>
      )

    case 'divider':
      return <hr className="my-10 border-t-2 border-ink" />

    case 'image':
      return <PostImage props={block.props ?? {}} />

    case 'videoEmbed':
      return <VideoEmbed props={block.props ?? {}} />

    case 'references':
      return <References props={block.props ?? {}} />

    default:
      // Forward compatibility: an unknown block is skipped, never fatal.
      return null
  }
}

const LIST_TYPES = { bulletListItem: 'ul', numberedListItem: 'ol', checkListItem: 'ul' }

// Consecutive list-item blocks are gathered into one real list element so the
// markup is valid and screen readers announce "list of 3 items".
function groupBlocks(blocks) {
  const groups = []
  for (const block of blocks) {
    const listTag = LIST_TYPES[block.type]
    const previous = groups.at(-1)
    if (listTag && previous?.tag === listTag) {
      previous.items.push(block)
    } else if (listTag) {
      groups.push({ tag: listTag, items: [block] })
    } else {
      groups.push({ block })
    }
  }
  return groups
}

export function BlockRenderer({ content }) {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []

  return (
    <>
      {groupBlocks(blocks).map((group, index) => {
        if (group.block) return <Block key={index} block={group.block} />

        const ListTag = group.tag
        return (
          <ListTag
            key={index}
            className={`my-5 space-y-1.5 pl-6 ${group.tag === 'ol' ? 'list-decimal' : 'list-disc'}`}
          >
            {group.items.map((item) => (
              <li key={item.id}>
                <Inline nodes={item.content} />
                {item.children?.length ? (
                  <BlockRenderer content={{ blocks: item.children }} />
                ) : null}
              </li>
            ))}
          </ListTag>
        )
      })}
    </>
  )
}
