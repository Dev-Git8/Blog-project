export const config = {
  matcher: '/blog/:slug*',
}

const CRAWLERS =
  /(facebookexternalhit|twitterbot|slackbot|discordbot|linkedinbot|whatsapp|telegrambot|googlebot|bingbot|pinterest|redditbot|embedly|quora link preview|skypeuripreview|vkshare)/i

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') ?? ''
  // Humans and unknown agents fall through to the SPA. The worst case for a
  // spoofed or unrecognised crawler is a missing preview, never a broken page.
  if (!CRAWLERS.test(userAgent)) return

  const apiUrl = process.env.VITE_API_URL
  if (!apiUrl) return

  const slug = new URL(request.url).pathname.replace(/^\/blog\//, '').replace(/\/$/, '')
  if (!slug || slug.includes('/')) return

  try {
    const response = await fetch(`${apiUrl}/api/meta/post/${encodeURIComponent(slug)}`)
    if (!response.ok) return
    return new Response(await response.text(), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  } catch {
    // Never let a meta failure take down the real page.
    return
  }
}
