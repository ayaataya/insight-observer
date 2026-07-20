import { useEffect, useRef, useState } from 'react'
import { formatSeconds } from '../lib/youtube'

const MAX_FRAMES = 20

let youtubeApiPromise = null
function loadYoutubeIframeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return youtubeApiPromise
}

export default function WatchStage({ videoId, durationSeconds, onFinished }) {
  const playerContainerRef = useRef(null)
  const playerRef = useRef(null)
  const webcamVideoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const framesRef = useRef([])
  const captureIntervalRef = useRef(null)
  const finishedRef = useRef(false)

  const [webcamError, setWebcamError] = useState(null)
  const [status, setStatus] = useState('Requesting webcam access…')
  const [frameCount, setFrameCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream
        }
        setStatus('Loading video player…')
      } catch {
        setWebcamError(
          'Could not access your webcam. Please allow camera permissions and reload the page.'
        )
        return
      }

      const YT = await loadYoutubeIframeApi()
      if (cancelled) return

      playerRef.current = new YT.Player(playerContainerRef.current, {
        videoId,
        playerVars: { rel: 0, enablejsapi: 1 },
        events: {
          onReady: () => setStatus('Press play to begin. We\'ll sample your reactions as you watch.'),
          onStateChange: (event) => handleStateChange(event),
        },
      })
    }

    function captureFrame() {
      const video = webcamVideoRef.current
      const canvas = canvasRef.current
      const player = playerRef.current
      if (!video || !canvas || !player || video.readyState < 2) return

      canvas.width = 320
      canvas.height = (video.videoHeight / video.videoWidth) * 320 || 240
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      const timestamp = player.getCurrentTime?.() ?? 0

      framesRef.current.push({ timestamp, label: formatSeconds(timestamp), dataUrl })
      setFrameCount(framesRef.current.length)

      if (framesRef.current.length >= MAX_FRAMES) {
        stopCapturing()
      }
    }

    function stopCapturing() {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current)
        captureIntervalRef.current = null
      }
    }

    function startCapturing() {
      if (captureIntervalRef.current) return
      const intervalSeconds = Math.max(durationSeconds / MAX_FRAMES, 1)
      setStatus('Watching along… sampling your reactions.')
      // Capture the first frame immediately instead of waiting a full interval —
      // otherwise the 20th (final) tick lands right at the video's end and often
      // loses a race against the ENDED event, capping us at 19 frames.
      captureFrame()
      captureIntervalRef.current = setInterval(() => {
        const player = playerRef.current
        if (player && player.getPlayerState() === window.YT.PlayerState.PLAYING) {
          captureFrame()
        }
      }, intervalSeconds * 1000)
    }

    function finish() {
      if (finishedRef.current) return
      finishedRef.current = true
      stopCapturing()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      setStatus('Video finished.')
      onFinished(framesRef.current)
    }

    function handleStateChange(event) {
      const YT = window.YT
      if (event.data === YT.PlayerState.PLAYING) {
        startCapturing()
      } else if (event.data === YT.PlayerState.ENDED) {
        finish()
      }
    }

    setup()

    return () => {
      cancelled = true
      stopCapturing()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      playerRef.current?.destroy?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, durationSeconds])

  return (
    <div className="stage watch-stage">
      <h2>Watch the video</h2>
      <p className="status-line">{webcamError || status}</p>
      <div className="watch-layout">
        <div className="player-wrapper">
          <div ref={playerContainerRef} />
        </div>
        <div className="webcam-panel">
          <video ref={webcamVideoRef} autoPlay muted playsInline className="webcam-preview" />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <p className="frame-counter">
            Frames captured: {frameCount} / {MAX_FRAMES}
          </p>
          <div className="thumbnail-strip">
            {framesRef.current.map((frame, i) => (
              <div className="thumbnail" key={i}>
                <img src={frame.dataUrl} alt={`Captured reaction at ${frame.label}`} />
                <span>{frame.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
