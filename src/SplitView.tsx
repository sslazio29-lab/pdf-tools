import { useRef, useState } from 'react'
import { downloadPdf } from './lib/mergePdf'
import {
  extractPages,
  parsePageRange,
  splitIntoPages,
  splitIntoChunks,
} from './lib/splitPdf'
import { downloadZip } from './lib/zip'
import { renderThumbnails } from './lib/renderThumbnails'

/** 出力モード: 選択ページを1ファイルに抽出 / 全ページをバラバラ / Nページごと */
type Mode = 'extract' | 'pages' | 'chunks'

function SplitView() {
  const [file, setFile] = useState<File | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [rangeInput, setRangeInput] = useState('')
  const [mode, setMode] = useState<Mode>('extract')
  const [chunkSize, setChunkSize] = useState('5')
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
    setSelected(new Set())
    setRangeInput('')
    setIsLoading(true)
    try {
      const t = await renderThumbnails(f)
      setThumbs(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDFの読み込みに失敗しました')
      setFile(null)
    } finally {
      setIsLoading(false)
    }
  }

  function toggle(pageNum: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageNum)) next.delete(pageNum)
      else next.add(pageNum)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(thumbs.map((_, i) => i + 1)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function applyRange() {
    setError(null)
    try {
      const pages = parsePageRange(rangeInput, thumbs.length)
      if (pages.length === 0) {
        setError('有効なページがありません')
        return
      }
      setSelected(new Set(pages))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ページ指定が不正です')
    }
  }

  function reset() {
    setFile(null)
    setThumbs([])
    setSelected(new Set())
    setRangeInput('')
    setError(null)
  }

  async function handleRun() {
    if (!file) return
    setError(null)
    setIsWorking(true)
    try {
      const base = file.name.replace(/\.pdf$/i, '')
      if (mode === 'extract') {
        const pageNumbers = [...selected].sort((a, b) => a - b)
        const bytes = await extractPages(file, pageNumbers)
        downloadPdf(bytes, `${base}_extracted.pdf`)
      } else if (mode === 'pages') {
        const files = await splitIntoPages(file)
        await downloadZip(files, `${base}_pages.zip`)
      } else {
        const size = Number(chunkSize)
        const files = await splitIntoChunks(file, size)
        await downloadZip(files, `${base}_split.zip`)
      }
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

  // 実行ボタンの活性条件とラベル
  const chunkNum = Number(chunkSize)
  const chunkValid = Number.isInteger(chunkNum) && chunkNum >= 1
  const runDisabled =
    isWorking ||
    (mode === 'extract' && selected.size === 0) ||
    (mode === 'chunks' && !chunkValid)

  function runLabel(): string {
    if (isWorking) return '処理中…'
    if (mode === 'extract') {
      return selected.size === 0
        ? 'ページを選択してください'
        : `${selected.size}ページを抽出してダウンロード`
    }
    if (mode === 'pages') {
      return `全${thumbs.length}ページをバラバラにしてZIPダウンロード`
    }
    return chunkValid
      ? `${chunkNum}ページごとに分割してZIPダウンロード`
      : 'ページ数を正しく入力してください'
  }

  return (
    <>
      <p className="subtitle">
        PDFをページ単位で抽出・分割します。ファイルはブラウザ内で処理され、外部に送信されません。
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
              <div className="mode-row" role="radiogroup" aria-label="出力モード">
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'extract'}
                  className={`mode-btn${mode === 'extract' ? ' active' : ''}`}
                  onClick={() => setMode('extract')}
                >
                  選択ページを抽出
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'pages'}
                  className={`mode-btn${mode === 'pages' ? ' active' : ''}`}
                  onClick={() => setMode('pages')}
                >
                  全ページをバラバラに
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'chunks'}
                  className={`mode-btn${mode === 'chunks' ? ' active' : ''}`}
                  onClick={() => setMode('chunks')}
                >
                  Nページごとに分割
                </button>
              </div>

              {mode === 'extract' && (
                <div className="range-row">
                  <input
                    type="text"
                    className="range-input"
                    placeholder="範囲指定（例: 1-3,5）"
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyRange()
                    }}
                  />
                  <button type="button" onClick={applyRange}>
                    範囲を選択
                  </button>
                  <button type="button" onClick={selectAll}>
                    全選択
                  </button>
                  <button type="button" onClick={clearSelection}>
                    選択解除
                  </button>
                </div>
              )}

              {mode === 'chunks' && (
                <div className="range-row">
                  <label className="chunk-label">
                    1ファイルあたり
                    <input
                      type="number"
                      min={1}
                      className="chunk-input"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(e.target.value)}
                    />
                    ページ
                  </label>
                </div>
              )}

              <div className="thumb-grid">
                {thumbs.map((src, i) => {
                  const pageNum = i + 1
                  const isSel = mode === 'extract' && selected.has(pageNum)
                  return (
                    <button
                      type="button"
                      key={pageNum}
                      className={`thumb${isSel ? ' selected' : ''}`}
                      onClick={() => mode === 'extract' && toggle(pageNum)}
                      aria-pressed={isSel}
                      aria-label={`${pageNum}ページ目${isSel ? '（選択中）' : ''}`}
                      disabled={mode !== 'extract'}
                    >
                      <img src={src} alt={`${pageNum}ページ目`} loading="lazy" />
                      <span className="thumb-num">{pageNum}</span>
                    </button>
                  )
                })}
              </div>

              <div className="toolbar">
                <span className="muted">
                  {mode === 'extract' && selected.size > 0
                    ? `${selected.size} / ${thumbs.length} ページ選択中`
                    : `全${thumbs.length}ページ`}
                </span>
                <button
                  type="button"
                  className="primary"
                  onClick={handleRun}
                  disabled={runDisabled}
                >
                  {runLabel()}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

export default SplitView
