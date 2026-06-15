import { useRef, useState } from 'react'
import { downloadPdf } from './lib/mergePdf'
import { buildEditedPdf } from './lib/editPdf'
import { renderThumbnails } from './lib/renderThumbnails'
import SizeToggle, { type ThumbSize } from './SizeToggle'

/** 編集中の1ページ分の状態。 */
type PageItem = {
  /** 並べ替え・削除に強い安定id */
  id: number
  /** 元PDFでの0始まりインデックス（サムネイル参照にも使う） */
  srcIndex: number
  /** 追加回転角（度・90の倍数） */
  rotation: number
}

function EditView() {
  const [file, setFile] = useState<File | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [pages, setPages] = useState<PageItem[]>([])
  const [thumbSize, setThumbSize] = useState<ThumbSize>('md')
  const [isLoading, setIsLoading] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadFile(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const f = Array.from(fileList).find(
      (x) => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'),
    )
    if (!f) {
      setError('PDFファイルを選択してください')
      return
    }
    setError(null)
    setFile(f)
    setThumbs([])
    setPages([])
    setIsLoading(true)
    try {
      const t = await renderThumbnails(f)
      setThumbs(t)
      setPages(t.map((_, i) => ({ id: i, srcIndex: i, rotation: 0 })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDFの読み込みに失敗しました')
      setFile(null)
    } finally {
      setIsLoading(false)
    }
  }

  function move(index: number, dir: -1 | 1) {
    setPages((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function rotate(index: number) {
    setPages((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
      ),
    )
  }

  function remove(index: number) {
    setPages((prev) => prev.filter((_, i) => i !== index))
  }

  function resetPages() {
    setPages(thumbs.map((_, i) => ({ id: i, srcIndex: i, rotation: 0 })))
    setError(null)
  }

  function reset() {
    setFile(null)
    setThumbs([])
    setPages([])
    setError(null)
  }

  async function handleSave() {
    if (!file || pages.length === 0) return
    setError(null)
    setIsWorking(true)
    try {
      const ops = pages.map((p) => ({ srcIndex: p.srcIndex, rotation: p.rotation }))
      const bytes = await buildEditedPdf(file, ops)
      const base = file.name.replace(/\.pdf$/i, '')
      downloadPdf(bytes, `${base}_edited.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '処理中にエラーが発生しました')
    } finally {
      setIsWorking(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    loadFile(e.dataTransfer.files)
  }

  return (
    <>
      <p className="subtitle">
        ページの並べ替え・回転・削除をして保存します。ファイルはブラウザ内で処理され、外部に送信されません。
      </p>

      {!file && (
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
          <p className="muted">またはクリックして選択（1ファイル）</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              loadFile(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {file && (
        <>
          <div className="split-fileinfo">
            <span className="file-name" title={file.name}>
              {file.name}
            </span>
            <button type="button" className="ghost" onClick={reset}>
              別のファイルを選ぶ
            </button>
          </div>

          {isLoading && <p className="muted">サムネイルを生成中…</p>}

          {!isLoading && thumbs.length > 0 && (
            <>
              <div className="range-row">
                <button type="button" onClick={resetPages}>
                  すべてリセット
                </button>
              </div>

              <SizeToggle value={thumbSize} onChange={setThumbSize} />

              {pages.length === 0 ? (
                <p className="muted">
                  すべてのページが削除されました。「すべてリセット」で元に戻せます。
                </p>
              ) : (
                <div className={`thumb-grid size-${thumbSize}`}>
                  {pages.map((p, i) => (
                    <div key={p.id} className="page-card">
                      <div className="page-thumb">
                        <img
                          src={thumbs[p.srcIndex]}
                          alt={`元の${p.srcIndex + 1}ページ目`}
                          loading="lazy"
                          style={{ transform: `rotate(${p.rotation}deg)` }}
                        />
                        <span className="thumb-num">{i + 1}</span>
                      </div>
                      <div className="page-ops">
                        <button
                          type="button"
                          title="左へ移動"
                          aria-label="左へ移動"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          title="90°回転"
                          aria-label="90度回転"
                          onClick={() => rotate(i)}
                        >
                          ⟳
                        </button>
                        <button
                          type="button"
                          title="削除"
                          aria-label="削除"
                          onClick={() => remove(i)}
                        >
                          🗑
                        </button>
                        <button
                          type="button"
                          title="右へ移動"
                          aria-label="右へ移動"
                          onClick={() => move(i, 1)}
                          disabled={i === pages.length - 1}
                        >
                          →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="toolbar">
                <span className="muted">
                  {pages.length} / {thumbs.length} ページ
                </span>
                <button
                  type="button"
                  className="primary"
                  onClick={handleSave}
                  disabled={isWorking || pages.length === 0}
                >
                  {isWorking ? '処理中…' : '編集を保存してダウンロード'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

export default EditView
