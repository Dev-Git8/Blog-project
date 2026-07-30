import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { filterSuggestionItems } from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { schema, customSlashItems } from '../blocks/schema.jsx'
import { uploadImage } from '../lib/api.js'

export function BlockEditor({ initialContent, onChange }) {
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent?.length ? initialContent : undefined,
    // Dropping or pasting an image uploads it and stores the returned URL.
    uploadFile: async (file) => {
      const { url } = await uploadImage(file)
      return url
    },
  })

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      slashMenu={false}
      onChange={() => onChange({ blocks: editor.document })}
      className="rounded-2xl border-2 border-ink bg-card py-4"
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            [...getDefaultReactSlashMenuItems(editor), ...customSlashItems(editor)],
            query,
          )
        }
      />
    </BlockNoteView>
  )
}
