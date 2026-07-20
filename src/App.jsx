import { useState } from 'react'
import './App.css'
import RevealSection from './components/RevealSection'
import UrlStage from './components/UrlStage'
import WatchStage from './components/WatchStage'
import VisualEvaluationStage from './components/VisualEvaluationStage'
import InterviewStage from './components/InterviewStage'
import ReportStage from './components/ReportStage'

const STAGES = ['url', 'watch', 'evaluation', 'interview', 'report']

function App() {
  const [stage, setStage] = useState('url')
  const [videoMetadata, setVideoMetadata] = useState(null)
  const [frames, setFrames] = useState([])
  const [visualEvaluation, setVisualEvaluation] = useState(null)
  const [chatHistory, setChatHistory] = useState([])

  function handleRestart() {
    setVideoMetadata(null)
    setFrames([])
    setVisualEvaluation(null)
    setChatHistory([])
    setStage('url')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <svg viewBox="0 0 24 24" className="brand-icon" aria-hidden="true">
            <rect x="1" y="1" width="22" height="22" rx="7" fill="#FF0000" />
            <ellipse cx="12" cy="12" rx="7.2" ry="4.6" fill="none" stroke="#fff" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="2.3" fill="#fff" />
          </svg>
          <h1>YouWatch</h1>
        </div>
        <p>Watch a video, get watched back, then talk it through.</p>
        <ol className="stage-tracker">
          {STAGES.map((s) => (
            <li key={s} className={s === stage ? 'active' : ''}>
              {s}
            </li>
          ))}
        </ol>
      </header>

      <main>
        <RevealSection autoScroll={false}>
          <UrlStage
            onMetadataReady={(metadata) => {
              setVideoMetadata(metadata)
              setStage('watch')
            }}
          />
        </RevealSection>

        {videoMetadata && (
          <RevealSection key="watch">
            <WatchStage
              videoId={videoMetadata.videoId}
              durationSeconds={videoMetadata.duration_seconds}
              onFinished={(capturedFrames) => {
                setFrames(capturedFrames)
                setStage('evaluation')
              }}
            />
          </RevealSection>
        )}

        {frames.length > 0 && (
          <RevealSection key="evaluation">
            <VisualEvaluationStage
              frames={frames}
              videoMetadata={videoMetadata}
              onDone={(evaluationText) => {
                setVisualEvaluation(evaluationText)
                setStage('interview')
              }}
            />
          </RevealSection>
        )}

        {visualEvaluation && (
          <RevealSection key="interview">
            <InterviewStage
              videoMetadata={videoMetadata}
              visualEvaluation={visualEvaluation}
              onEndChat={(history) => {
                setChatHistory(history)
                setStage('report')
              }}
            />
          </RevealSection>
        )}

        {chatHistory.length > 0 && (
          <RevealSection key="report">
            <ReportStage
              videoMetadata={videoMetadata}
              visualEvaluation={visualEvaluation}
              chatHistory={chatHistory}
              onRestart={handleRestart}
            />
          </RevealSection>
        )}
      </main>
    </div>
  )
}

export default App
