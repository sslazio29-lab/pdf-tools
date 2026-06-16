import { useRef, useState } from 'react'
import {
  ocrPdf,
  downloadText,
  downloadPdfBytes,
  type OcrProgress,
  type OcrResult,
} from './lib/ocr'

function OCRView() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<OcrResult | null>(null)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function loadFile(fileList: FileList | null) {
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
    setResult(null)
    setProgress(null)
  }

  function reset() {
    setFile(null)
    setResult(null)
    setProgress(null)
    setError(null)
  }

  async function handleRun() {
    if (!file) return
    setError(null)
    setResult(null)
    setProgress(null)
    setIsWorking(true)
    try {
      const r = await ocrPdf(file, setProgress)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR処理中にエラーが発生しました')
    } finally {
      setIsWorking(false)
    }
  }

  function handleDownloadText() {
    if (!result || !file) return
    const base = file.name.replace(/\.pdf$/i, '')
    downloadText(result.text, `${base}.txt`)
  }

  function handleDownloadPdf() {
    if (!result || !file) return
    const base = file.name.replace(/\.pdf$/i, '')
    downloadPdfBytes(result.pdfBytes, `${base}_検索可能.pdf`)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    loadFile(e.dataTransfer.files)
  }

  function progressLabel(p: OcrProgress): string {
    if (p.phase === 'render') {
      return `${p.page} / ${p.total} ページ目を描画中…`
    }
    return `${p.page} / ${p.total} ページ目を認識中… ${Math.round(p.ratio * 100)}%`
  }

  return (
    <>
      <p className="subtitle">
        スキャンされたPDFから文字を読み取り（OCR）、テキストとして書き出します。
        PDFの中身はブラウザ内で処理され外部に送信されません（OCRエンジンと言語データの初回読込のみCDNから取得します）。
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
            <button type="button" className="ghost" onClick={reset} disabled={isWorking}>
              別のファイルを選ぶ
            </button>
          </div>

          <div className="toolbar">
            <span className="muted">
              {isWorking && progress
                ? progressLabel(progress)
                : isWorking
                  ? 'OCRエンジンを準備中…（初回は言語データの読込に時間がかかります）'
                  : result !== null
                    ? '完了'
                    : 'OCRを実行できます'}
            </span>
            <button
              type="button"
              className="primary"
              onClick={handleRun}
              disabled={isWorking}
            >
              {isWorking ? '処理中…' : 'OCRを実行'}
            </button>
          </div>

          {result !== null && (
            <>
              <div className="toolbar">
                <span className="muted">抽出結果</span>
                <div className="ocr-actions">
                  <button type="button" className="ghost" onClick={handleDownloadText}>
                    テキスト（.txt）
                  </button>
                  <button type="button" className="primary" onClick={handleDownloadPdf}>
                    検索可能PDF（.pdf）をダウンロード
                  </button>
                </div>
              </div>
              <textarea
                className="ocr-output"
                value={result.text}
                readOnly
                spellCheck={false}
                aria-label="OCR抽出結果"
              />
            </>
          )}
        </>
      )}
    </>
  )
}

export default OCRView
