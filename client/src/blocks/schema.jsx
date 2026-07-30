import { BlockNoteSchema, defaultBlockSpecs, insertOrUpdateBlock } from '@blocknote/core'
import { VideoEmbedBlock } from './videoEmbed.jsx'
import { ReferencesBlock } from './references.jsx'

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    videoEmbed: VideoEmbedBlock,
    references: ReferencesBlock,
  },
})

// Slash-menu entries, so both custom blocks are reachable the same way as the
// built-ins rather than needing a separate toolbar.
export const customSlashItems = (editor) => [
  {
    title: 'Video embed',
    subtext: 'Embed a YouTube or Vimeo video',
    aliases: ['video', 'youtube', 'vimeo', 'embed'],
    group: 'Media',
    onItemClick: () => insertOrUpdateBlock(editor, { type: 'videoEmbed' }),
  },
  {
    title: 'References',
    subtext: 'A numbered list of source links',
    aliases: ['reference', 'sources', 'links', 'citations'],
    group: 'Media',
    onItemClick: () => insertOrUpdateBlock(editor, { type: 'references' }),
  },
]
