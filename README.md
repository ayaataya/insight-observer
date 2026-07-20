# YouWatch

A React + Vite web app where an AI "watches" you watch a YouTube video via
webcam, interviews you about it afterward, and writes a final sentiment
report. Watch a video, get watched back, then talk it through.

## How it works

1. **YouTube Video Metadata** — paste a YouTube URL and fetch its Title,
   Duration, Description, and full Transcript.
2. **Visual Evaluation** — while you watch the embedded video, your webcam
   captures up to 20 evenly-spaced frames. Once the video ends, those frames
   are sent to an OpenAI vision model for a written evaluation of your
   apparent reactions, displayed in the UI.
3. **The Interviewer** — click **Start Interview** to open a chatbot whose
   system prompt includes the video metadata and the visual evaluation. It
   asks what you liked/disliked and references specific moments (e.g. "I
   noticed you smiled around 0:24 — what caused that?").
4. **Final Synthesis** — click **End Chat** to send the full chat history,
   video metadata, and visual evaluation to the AI for a final written
   sentiment report, displayed in a formatted layout.

## Stack notes

- Scaffolded with `npm create vite@latest -- --template react`.
- Main UI: [src/App.jsx](src/App.jsx), with stage components under
  [src/components/](src/components/) and AI/YouTube helpers under
  [src/lib/](src/lib/).
- **No separate backend process.** YouTube metadata and transcript fetching
  happen in a custom Vite dev-server middleware
  ([server/youtubePlugin.js](server/youtubePlugin.js)), so everything still
  runs from a single `npm run dev`. This exists because YouTube's caption
  endpoints require a signed token that a plain browser `fetch` can't obtain
  (CORS also blocks calling youtube.com directly from client code) — the
  middleware parses the watch page for title/duration/description and drives
  a headless Chromium (Puppeteer) to open the video's own "Show transcript"
  panel and read it back, the same way a real viewer would.
- OpenAI calls (vision evaluation, interview chat, final synthesis) are made
  directly from the browser using `fetch`, per the assignment's
  `VITE_OPENAI_API_KEY` convention.

## Setup

```bash
npm install
cp .env.example .env   # then edit .env and add your OpenAI API key
npm run dev
```

Open http://localhost:5173.

### Environment variables (`.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_OPENAI_API_KEY` | Yes | Your OpenAI API key. Never commit this — `.env` is gitignored. |
| `VITE_OPENAI_MODEL` | No | Overrides the model used for vision/chat calls. Defaults to `gpt-5.6` per the assignment spec. |

The first Puppeteer install downloads a Chromium binary (used only by the
dev-server transcript middleware, never shipped to the browser bundle) —
this happens automatically during `npm install`.

## Getting the required `ai_grading/` outputs

After completing a full run of the app on the test video
(`https://www.youtube.com/watch?v=Mzw2ttJD2qQ`) — watch it through, let the
Visual Evaluation finish, do the interview, then click **End Chat** — the
Final Synthesis screen has an **Export ai_grading files** button. It
downloads:

- `video_metadata.json`
- `visual_evaluation.txt`
- `final_prompt.txt`
- `final_report.txt`

Move those four downloaded files into the `ai_grading/` folder at the repo
root (replacing the placeholders there) before pushing.

## Project structure

```
insight_observer/
├── package.json
├── vite.config.js
├── server/youtubePlugin.js   # dev-server middleware: YouTube metadata + transcript
├── index.html
├── src/
│   ├── App.jsx
│   ├── components/           # UrlStage, WatchStage, VisualEvaluationStage, InterviewStage, ReportStage
│   └── lib/                  # openai.js, youtube.js, download.js
└── ai_grading/
    ├── final_prompt.txt
    ├── visual_evaluation.txt
    ├── video_metadata.json
    └── final_report.txt
```
