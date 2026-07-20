import { useState } from 'react'
import { fetchYoutubeMetadata } from '../lib/youtube'

export default function UrlStage({ onMetadataReady }) {
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=Mzw2ttJD2qQ')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [metadata, setMetadata] = useState(null)

  async function handleFetch(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMetadata(null)
    try {
      const data = await fetchYoutubeMetadata(url)
      setMetadata(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stage url-stage">
      <h2>1. Load a YouTube video</h2>
      <form onSubmit={handleFetch} className="url-form">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Fetching…' : 'Fetch Video'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {metadata && (
        <div className="metadata-card">
          <h3>{metadata.title}</h3>
          <p className="meta-row">
            <strong>Duration:</strong> {metadata.duration_seconds} seconds
          </p>
          <p className="meta-row description">
            <strong>Description:</strong>
            <span>{metadata.description}</span>
          </p>
          <details>
            <summary>Transcript</summary>
            <pre className="transcript-block">{metadata.transcript}</pre>
          </details>
          <button className="primary" onClick={() => onMetadataReady(metadata)}>
            Continue to Watch →
          </button>
        </div>
      )}
    </div>
  )
}
