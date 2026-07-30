// Allowlist of embeddable providers. Anything unmatched is rejected, which is
// what keeps arbitrary iframes out of posts.
export function parseVideoUrl(input) {
  if (typeof input !== 'string' || !input.trim()) return null

  let url
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const YT_ID = /^[\w-]{11}$/

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v')
    if (v && YT_ID.test(v)) return { provider: 'youtube', videoId: v }
    const path = url.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{11})\/?$/)
    if (path) return { provider: 'youtube', videoId: path[1] }
    return null
  }

  if (host === 'youtu.be') {
    const path = url.pathname.match(/^\/([\w-]{11})\/?$/)
    return path ? { provider: 'youtube', videoId: path[1] } : null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const path = url.pathname.match(/^\/(?:video\/)?(\d{6,12})(?:\/|$)/)
    return path ? { provider: 'vimeo', videoId: path[1] } : null
  }

  return null
}

export function embedUrl({ provider, videoId }) {
  return provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${videoId}`
    : `https://player.vimeo.com/video/${videoId}`
}
