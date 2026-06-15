import { useRef, useState } from 'react'
import { mergePdfs, downloadPdf } from './lib/mergePdf'
import { formatSize } from './lib/format'

/** 選択されたPDFを一意に識別するための内部表現 */
type PdfItem = {
  id: string
  file: File
}

function MergeView() {
  const [items, setItems] = useState<PdfItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    )
    if (pdfs.length === 0) {
      setError('PDFファイルを選択してください')
      return
    }
    setError(null)
    setItems((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
      })),
    ])
  }

  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function clearAll() {
    setItems([])
    setError(null)
  }

  async function handleMerge() {
    setError(null)
    setIsMerging(true)
    try {
      const bytes = await mergePdfs(items.map((it) => it.file))
      downloadPdf(bytes, 'merged.pdf')
    } catch (e) {
      setError(e instanceof Error ? e.message : '結合中にエラーが発生しました')
    } finally {
      setIsMerging(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  return (
    <>
      <p className="subtitle">
        複数のPDFを1つにまとめます。ファイルはブラウザ内で処理され、外部に送信されません。
      </p>

      <div
        className={`dropzone${isDragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <p>ここにPDFをドラッグ&amp;ドロップ</p>
        <p className="muted">またはクリックして選択</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="error">{error}</p>}

      {items.length > 0 && (
        <>
          <ol className="file-list">
            {items.map((it, i) => (
              <li key={it.id} className="file-item">
                <span className="file-index">{i + 1}</span>
                <span className="file-name" title={it.file.name}>
                  {it.file.name}
                </span>
                <span className="file-size muted">{formatSize(it.file.size)}</span>
                <span className="file-actions">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="上へ"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    aria-label="下へ"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => remove(it.id)}
                    aria-label="削除"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ol>

          <div className="toolbar">
            <button type="button" className="ghost" onClick={clearAll}>
              すべてクリア
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleMerge}
              disabled={items.length < 2 || isMerging}
            >
              {isMerging
                ? '結合中…'
                : items.length < 2
                  ? 'PDFを2つ以上追加してください'
                  : `${items.length}個のPDFを結合してダウンロード`}
            </button>
          </div>
        </>
      )}
    </>
  )
}

export default MergeView
