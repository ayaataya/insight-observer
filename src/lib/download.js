export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can race the browser's own read of the blob and
  // silently drop the download, especially when several are triggered back
  // to back — give it a moment before freeing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function downloadJsonFile(filename, data) {
  downloadTextFile(filename, JSON.stringify(data, null, 2))
}

// Triggers multiple downloads with a small stagger between each — firing
// them all in one synchronous tick causes some browsers (Chrome in
// particular) to throttle/drop all but one as "automatic multiple downloads".
export async function downloadFilesStaggered(files) {
  for (const { filename, content, json } of files) {
    if (json) {
      downloadJsonFile(filename, content)
    } else {
      downloadTextFile(filename, content)
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
}
