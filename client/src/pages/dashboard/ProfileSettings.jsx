import { useState } from 'react'
import { api, uploadImage } from '../../lib/api.js'
import { useAuth } from '../../lib/useAuth.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Input } from '../../components/ui/Input.jsx'
import { Textarea } from '../../components/ui/Textarea.jsx'
import { Button } from '../../components/ui/Button.jsx'

export function ProfileSettings() {
  const { user, updateUser } = useAuth()
  const { show } = useToast()

  const [form, setForm] = useState({
    displayName: user.displayName ?? '',
    bio: user.bio ?? '',
    avatarUrl: user.avatarUrl ?? null,
  })
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)

  async function onAvatar(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const { url } = await uploadImage(file)
      setForm((current) => ({ ...current, avatarUrl: url }))
    } catch (error) {
      show(error.message, 'error')
    }
  }

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setFields({})
    try {
      const { user: updated } = await api.patch('/api/me', form)
      updateUser(updated)
      show('Profile saved.')
    } catch (error) {
      setFields(error.fields ?? {})
      if (!Object.keys(error.fields ?? {}).length) show(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <h1 className="display text-5xl">Your profile</h1>
      <p className="mt-2 text-sm">
        This is what readers see at <code>/@{user.username}</code>.
      </p>

      <Card className="mt-8 p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="displayName"
            label="Display name"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            error={fields.displayName}
          />
          <Textarea
            id="bio"
            label="Bio"
            maxLength={280}
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
            error={fields.bio}
          />
          <p className="-mt-2 text-xs">{form.bio.length} of 280 characters</p>

          <div className="flex items-center gap-4">
            {form.avatarUrl ? (
              <img
                src={form.avatarUrl}
                alt="Your avatar"
                className="size-16 rounded-full border-2 border-ink object-cover"
              />
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="avatar" className="text-sm font-semibold">
                Avatar
              </label>
              <input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={onAvatar}
                className="text-sm"
              />
            </div>
          </div>

          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
