import { useEffect, useRef, useState } from 'react'
import { runFinalSynthesis } from '../lib/openai'
import { downloadFilesStaggered } from '../lib/download'

export default function ReportStage({ videoMetadata, visualEvaluation, chatHistory, onRestart }) {
  const [status, setStatus] = useState('loading')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    runFinalSynthesis({ videoMetadata, visualEvaluation, chatHistory })
      .then((r) => {
        setResult(r)
        setStatus('done')
      })
      .catch((err) => {
        setError(err.message)
        setStatus('error')
      })
  }, [videoMetadata, visualEvaluation, chatHistory])

  async function handleExport() {
    setExporting(true)
    try {
      await downloadFilesStaggered([
        { filename: 'video_metadata.json', content: videoMetadata, json: true },
        { filename: 'visual_evaluation.txt', content: visualEvaluation },
        { filename: 'final_prompt.txt', content: result.prompt },
        { filename: 'final_report.txt', content: result.report },
      ])
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="stage report-stage">
      <h2>4. Final Synthesis</h2>

      {status === 'loading' && <p className="status-line">Writing your sentiment report…</p>}
      {status === 'error' && <p className="error-text">{error}</p>}

      {status === 'done' && (
        <>
          <div className="report-card">
            {result.report.split('\n').map((line, i) => {
              const trimmed = line.trim()
              if (!trimmed) return null
              const isHeading = /^(#+\s*)?(overall sentiment|key likes|key dislikes|notable moments|summary)/i.test(
                trimmed.replace(/[:*]/g, '')
              )
              return isHeading ? (
                <h3 key={i}>{trimmed.replace(/[#*]/g, '')}</h3>
              ) : (
                <p key={i}>{trimmed}</p>
              )
            })}
          </div>

          <div className="report-actions">
            <button className="primary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export ai_grading files'}
            </button>
            {onRestart && (
              <button className="secondary" onClick={onRestart}>
                Start Over
              </button>
            )}
          </div>
          <p className="hint-text">
            Downloads video_metadata.json, visual_evaluation.txt, final_prompt.txt, and
            final_report.txt one at a time (your browser may ask to allow multiple
            downloads — choose Allow) — move these into the <code>ai_grading/</code> folder
            of your repo.
          </p>
        </>
      )}
    </div>
  )
}
