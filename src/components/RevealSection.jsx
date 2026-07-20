import { useEffect, useRef, useState } from 'react'

export default function RevealSection({ children, autoScroll = true }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (visible && autoScroll) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  return (
    <div ref={ref} className={`reveal-section${visible ? ' visible' : ''}`}>
      {children}
    </div>
  )
}
