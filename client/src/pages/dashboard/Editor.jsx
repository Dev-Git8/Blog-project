import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, uploadImage } from '../../lib/api.js'
import { useAutosave } from '../../lib/useAutosave.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { PostMetaBar } from '../../components/PostMetaBar.jsx'
import { BlockEditor } from '../../components/BlockEditor.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'

export function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()

  const [post, setPost] = useState(null)
  const [content, setContent] = useState({ blocks: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // A visit to /dashboard/new creates the draft immediately, so there is always
  // a real post id to autosave against — no "unsaved new post" state to lose.
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        if (id) {
          const { post: loaded } = await api.get(`/api/posts/by-id/${id}`)
          if (cancelled) return
          setPost(loaded)
          setContent(loaded.content ?? { blocks: [] })
        } else {
          const { post: created } = await api.post('/api/posts', {})
          if (cancelled) return
          navigate(`/dashboard/posts/${created.id}`, { replace: true })
          return
        }
      } catch (error) {
        show(error.message, 'error')
        navigate('/dashboard', { replace: true })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, navigate, show])

  const saveDraft = useCallback(
    async (payload) => {
      const { post: saved } = await api.patch(`/api/posts/${id}`, payload)
      setPost((current) => ({ ...current, ...saved }))
    },
    [id],
  )

  const draftValue = post
    ? { title: post.title, tags: post.tags, coverImageUrl: post.coverImageUrl, content }
    : null

  const { status, dirty, saveNow } = useAutosave({
    value: draftValue,
    onSave: saveDraft,
    enabled: Boolean(post),
  })

  async function onPublish() {
    setBusy(true)
    try {
      await saveNow()
      const { post: published } = await api.post(`/api/posts/${id}/publish`)
      setPost(published)
      show('Published. Your post is live.')
    } catch (error) {
      const detail = Object.values(error.fields ?? {})[0]
      show(detail ?? error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onUnpublish() {
    setBusy(true)
    try {
      const { post: updated } = await api.post(`/api/posts/${id}/unpublish`)
      setPost(updated)
      show('Moved back to drafts.')
    } catch (error) {
      show(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await api.del(`/api/posts/${id}`)
      show('Post deleted.')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      show(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onCoverChange(file) {
    try {
      const { url } = await uploadImage(file)
      setPost((current) => ({ ...current, coverImageUrl: url }))
    } catch (error) {
      show(error.message, 'error')
    }
  }

  if (loading || !post) {
    return (
      <div className="flex justify-center p-16">
        <Spinner label="Opening your draft" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <PostMetaBar
        post={post}
        saveStatus={dirty && status === 'saved' ? 'idle' : status}
        onRetry={saveNow}
        busy={busy}
        onTitleChange={(title) => setPost((current) => ({ ...current, title }))}
        onTagsChange={(tags) => setPost((current) => ({ ...current, tags }))}
        onCoverChange={onCoverChange}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        onDelete={onDelete}
      />

      <div className="mt-8">
        <BlockEditor initialContent={post.content?.blocks} onChange={setContent} />
      </div>
    </div>
  )
}
