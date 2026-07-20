import { useEffect, useRef, useState } from 'react'
import { buildInterviewSystemPrompt, getInterviewerReply } from '../lib/openai'

export default function InterviewStage({ videoMetadata, visualEvaluation, onEndChat }) {
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const started = useRef(false)
  const systemPromptRef = useRef(
    buildInterviewSystemPrompt({ videoMetadata, visualEvaluation })
  )
  const scrollRef = useRef(null)

  useEffect(() => {
    if (started.current) return
    started.current = true
    setSending(true)
    getInterviewerReply({ systemPrompt: systemPromptRef.current, history: [] })
      .then((reply) => setHistory([{ role: 'assistant', content: reply }]))
      .catch((err) => setError(err.message))
      .finally(() => setSending(false))
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [history])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return

    const nextHistory = [...history, { role: 'user', content: input.trim() }]
    setHistory(nextHistory)
    setInput('')
    setSending(true)
    setError(null)
    try {
      const reply = await getInterviewerReply({
        systemPrompt: systemPromptRef.current,
        history: nextHistory,
      })
      setHistory([...nextHistory, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="stage interview-stage">
      <h2>3. The Interviewer</h2>
      <div className="chat-window" ref={scrollRef}>
        {history.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {sending && <div className="chat-bubble assistant pending">…</div>}
      </div>

      {error && <p className="error-text">{error}</p>}

      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your reply…"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>

      <button
        className="secondary end-chat-btn"
        onClick={() => onEndChat(history)}
        disabled={history.length === 0}
      >
        End Chat →
      </button>
    </div>
  )
}
