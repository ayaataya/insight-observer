export function extractYoutubeVideoId(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1)
    if (url.searchParams.has('v')) return url.searchParams.get('v')
    const embedMatch = url.pathname.match(/\/embed\/([^/?]+)/)
    if (embedMatch) return embedMatch[1]
    const shortsMatch = url.pathname.match(/\/shorts\/([^/?]+)/)
    if (shortsMatch) return shortsMatch[1]
  } catch {
    // fall through to regex fallback below
  }
  const match = rawUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:[?&]|$)/)
  return match ? match[1] : null
}

export async function fetchYoutubeMetadata(videoUrl) {
  const res = await fetch(`/api/youtube-metadata?url=${encodeURIComponent(videoUrl)}`)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch video metadata.')
  }
  return data
}

export function formatSeconds(totalSeconds) {
  const s = Math.floor(totalSeconds % 60)
  const m = Math.floor(totalSeconds / 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
