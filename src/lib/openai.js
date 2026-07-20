const API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5.6'
const CHAT_URL = 'https://api.openai.com/v1/chat/completions'

async function callOpenAI(messages, { maxTokens = 900 } = {}) {
  if (!API_KEY) {
    throw new Error(
      'Missing VITE_OPENAI_API_KEY. Add it to your .env file (see README.md) and restart the dev server.'
    )
  }

  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_completion_tokens: maxTokens,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI API request failed (status ${res.status}).`)
  }
  return data.choices[0].message.content.trim()
}

function formatVideoMetadataBlock(videoMetadata) {
  return [
    `Title: ${videoMetadata.title}`,
    `Duration: ${videoMetadata.duration_seconds} seconds`,
    `Description: ${videoMetadata.description}`,
    `Transcript:\n${videoMetadata.transcript}`,
  ].join('\n\n')
}

export async function runVisualEvaluation({ frames, videoMetadata }) {
  const content = [
    {
      type: 'text',
      text:
        `You are an observational engagement analyst. Below are up to 20 webcam snapshots ` +
        `captured at even intervals while a person watched this YouTube video:\n\n` +
        `${formatVideoMetadataBlock(videoMetadata)}\n\n` +
        `For each snapshot you are given its timestamp in the video. Study apparent facial expressions, ` +
        `posture, and engagement cues (smiling, laughing, leaning in, looking away, frowning, surprise, ` +
        `boredom, etc.) at each timestamp. Then write a "Visual Evaluation" with:\n` +
        `1) A short overall summary of the viewer's apparent engagement and emotional reaction.\n` +
        `2) A chronological list of the notable moments, each starting with the timestamp in ` +
        `[M:SS] format (matching the video's own timeline), describing the observed expression/reaction.\n` +
        `Be descriptive but measured — you are inferring visible expressions, not claiming certainty about ` +
        `internal feelings. Keep it concise and readable.`,
    },
  ]

  for (const frame of frames) {
    content.push({ type: 'text', text: `Frame at [${frame.label}]:` })
    content.push({ type: 'image_url', image_url: { url: frame.dataUrl } })
  }

  return callOpenAI([{ role: 'user', content }], { maxTokens: 1200 })
}

export function buildInterviewSystemPrompt({ videoMetadata, visualEvaluation }) {
  return (
    `You are a friendly, curious interviewer following up with someone right after they watched a YouTube video. ` +
    `You were also "watching" them via webcam snapshots while they watched, and an analyst produced a Visual ` +
    `Evaluation of their apparent reactions (below). Your job now is to interview them conversationally: ask what ` +
    `they liked and disliked about the video, and reference specific facial-expression moments from the Visual ` +
    `Evaluation using their timestamps (e.g., "I noticed you smiled around [0:24] — what caused that?"). Ask one ` +
    `question at a time, keep a warm and conversational tone, and let their answers guide follow-up questions. ` +
    `Begin the interview yourself with a short greeting and your first question — do not wait for the user to ` +
    `speak first.\n\n` +
    `=== VIDEO METADATA ===\n${formatVideoMetadataBlock(videoMetadata)}\n\n` +
    `=== VISUAL EVALUATION ===\n${visualEvaluation}`
  )
}

export async function getInterviewerReply({ systemPrompt, history }) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ]
  return callOpenAI(messages, { maxTokens: 500 })
}

export function buildFinalSynthesisPrompt({ videoMetadata, visualEvaluation, chatHistory }) {
  const transcriptOfChat = chatHistory
    .map((m) => `${m.role === 'assistant' ? 'Interviewer' : 'Viewer'}: ${m.content}`)
    .join('\n')

  return (
    `You are a sentiment analyst. Using the information below about a person's experience watching a YouTube ` +
    `video — the video's metadata, a Visual Evaluation of their facial expressions/engagement captured via ` +
    `webcam while they watched, and the full transcript of a post-video interview with them — write a clear, ` +
    `well-organized final report describing how this person felt about the video overall. Integrate evidence ` +
    `from all three sources (what they said, what their expressions suggested, and the video content itself). ` +
    `Structure the report with short sections: Overall Sentiment, Key Likes, Key Dislikes/Criticisms, Notable ` +
    `Moments (tying facial reactions to interview answers where possible), and a one-paragraph Summary.\n\n` +
    `=== VIDEO METADATA ===\n${formatVideoMetadataBlock(videoMetadata)}\n\n` +
    `=== VISUAL EVALUATION ===\n${visualEvaluation}\n\n` +
    `=== INTERVIEW TRANSCRIPT ===\n${transcriptOfChat}`
  )
}

export async function runFinalSynthesis({ videoMetadata, visualEvaluation, chatHistory }) {
  const prompt = buildFinalSynthesisPrompt({ videoMetadata, visualEvaluation, chatHistory })
  const report = await callOpenAI([{ role: 'user', content: prompt }], { maxTokens: 1400 })
  return { prompt, report }
}
