// Vite dev-server middleware that fetches YouTube video metadata + transcript
// server-side so the whole app still runs with a single `npm run dev` and no
// separate backend process.
//
// - Title / duration / description come from parsing the watch page's
//   embedded ytInitialPlayerResponse JSON (fast, no browser needed).
// - The transcript is scraped with a headless browser (Puppeteer). YouTube's
//   raw timedtext/caption endpoints now require a signed "PO token" that a
//   plain server-side fetch cannot obtain, so we drive an actual Chromium
//   instance to open the video's own "Show transcript" panel and read the
//   rendered lines, exactly like a real viewer would.

import puppeteer from 'puppeteer'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
}

function extractVideoId(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1)
    }
    if (url.searchParams.has('v')) {
      return url.searchParams.get('v')
    }
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

async function fetchVideoMetadata(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const res = await fetch(watchUrl, { headers: BROWSER_HEADERS })
  if (!res.ok) {
    throw new Error(`Failed to load YouTube page (status ${res.status})`)
  }
  const html = await res.text()

  const match = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s)
  if (!match) {
    throw new Error('Could not locate video data on the YouTube page (layout may have changed).')
  }

  let playerResponse
  try {
    playerResponse = JSON.parse(match[1])
  } catch {
    throw new Error('Failed to parse YouTube video data.')
  }

  const details = playerResponse.videoDetails
  if (!details) {
    throw new Error('Video details unavailable (video may be private, age-restricted, or removed).')
  }

  return {
    videoId,
    title: details.title || '',
    description: details.shortDescription || '',
    duration_seconds: parseInt(details.lengthSeconds || '0', 10),
  }
}

// Reuse a single browser instance across requests instead of paying the
// ~1-2s launch cost on every metadata lookup.
let browserPromise = null
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ headless: true })
  }
  return browserPromise
}

async function fetchTranscript(videoId) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 1280, height: 1200 })
    await page.setUserAgent(BROWSER_HEADERS['User-Agent'])
    await page.goto(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })
    await new Promise((r) => setTimeout(r, 2000))

    // The transcript button only exists once the description is expanded.
    await page.evaluate(() => document.querySelector('#expand')?.click())
    await new Promise((r) => setTimeout(r, 800))

    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const btn = buttons.find((b) => /show transcript/i.test(b.textContent || ''))
      if (btn) {
        btn.click()
        return true
      }
      return false
    })
    if (!clicked) return null

    await new Promise((r) => setTimeout(r, 3000))

    // The transcript list can be virtualized for long videos; scroll the
    // panel to force any remaining segments to render.
    for (let i = 0; i < 15; i++) {
      const panelFound = await page.evaluate(() => {
        const panel = document.querySelector('#panels')
        if (!panel) return false
        panel.scrollTop = panel.scrollHeight
        return true
      })
      await new Promise((r) => setTimeout(r, 400))
      if (!panelFound) break
    }

    const segments = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('transcript-segment-view-model'))
      return els.map((el) => ({
        time: el.querySelector('.ytwTranscriptSegmentViewModelTimestamp')?.textContent?.trim() || '',
        text: el.querySelector('[role="text"]')?.textContent?.trim() || '',
      }))
    })

    if (segments.length === 0) return null
    return segments.map((seg) => `[${seg.time}] ${seg.text}`).join('\n')
  } finally {
    await page.close()
  }
}

export function youtubeMetadataPlugin() {
  return {
    name: 'youtube-metadata-middleware',
    configureServer(server) {
      server.middlewares.use('/api/youtube-metadata', async (req, res) => {
        try {
          const reqUrl = new URL(req.url, 'http://localhost')
          const videoUrl = reqUrl.searchParams.get('url')
          if (!videoUrl) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing "url" query parameter.' }))
            return
          }
          const videoId = extractVideoId(videoUrl)
          if (!videoId) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Could not parse a video ID from that URL.' }))
            return
          }

          const [metadataResult, transcriptResult] = await Promise.allSettled([
            fetchVideoMetadata(videoId),
            fetchTranscript(videoId),
          ])

          if (metadataResult.status === 'rejected') {
            throw metadataResult.reason
          }

          const transcript =
            transcriptResult.status === 'fulfilled' && transcriptResult.value
              ? transcriptResult.value
              : '(No captions/transcript available for this video.)'

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ...metadataResult.value, transcript }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message || 'Unknown server error.' }))
        }
      })

      server.httpServer?.once('close', async () => {
        if (browserPromise) {
          const browser = await browserPromise
          await browser.close()
        }
      })
    },
  }
}
