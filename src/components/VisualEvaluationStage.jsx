import { useEffect, useRef, useState } from 'react'
import { runVisualEvaluation } from '../lib/openai'

export default function VisualEvaluationStage({ frames, videoMetadata, onDone }) {
  const [status, setStatus] = useState('loading')
  const [evaluation, setEvaluation] = useState(null)
  const [error, setError] = useState(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    runVisualEvaluation({ frames, videoMetadata })
      .then((text) => {
        setEvaluation(text)
        setStatus('done')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [frames, videoMetadata])

  return (
    <div className="stage visual-evaluation-stage">
      <h2>2. Visual Evaluation</h2>

      <p className="frame-counter">{frames.length} frames captured</p>
      <div className="thumbnail-strip">
        {frames.map((frame, i) => (
          <div className="thumbnail" key={i}>
            <img src={frame.dataUrl} alt={`Captured reaction at ${frame.label}`} />
            <span>{frame.label}</span>
          </div>
        ))}
      </div>

      {status === 'loading' && (
        <p className="status-line">
          Analyzing {frames.length} captured frames with {import.meta.env.VITE_OPENAI_MODEL || 'gpt-5.6'}…
        </p>
      )}

      {status === 'error' && (
        <div>
          <p className="error-text">{error}</p>
        </div>
      )}

      {status === 'done' && (
        <>
          <div className="evaluation-card">
            {evaluation.split('\n').map((line, i) =>
              line.trim() ? <p key={i}>{line}</p> : null
            )}
          </div>
          <button className="primary" onClick={() => onDone(evaluation)}>
            Start Interview →
          </button>
        </>
      )}
    </div>
  )
}
