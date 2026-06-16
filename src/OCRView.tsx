import { useRef, useState } from 'react'
import { ocrPdf, downloadText, type OcrProgress } from './lib/ocr'

function OCRView() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState<string | null>(null)
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
    setText(null)
    setProgress(null)
  }

  function reset() {
    setFile(null)
    setText(null)
    setProgress(null)
    setError(null)
  }

  async function handleRun() {
    if (!file) return
    setError(null)
    setText(null)
    setProgress(null)
    setIsWorking(true)
    try {
      const result = await ocrPdf(file, setProgress)
      setText(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR処理中にエラーが発生しました')
    } finally {
      setIsWorking(false)
    }
  }

  function handleDownload() {
    if (text === null || !file) return
    const base = file.name.replace(/\.pdf$/i, '')
    downloadText(text, `${base}.txt`)
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
                  : text !== null
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

          {text !== null && (
            <>
              <div className="toolbar">
                <span className="muted">抽出結果</span>
                <button type="button" className="primary" onClick={handleDownload}>
                  テキスト（.txt）をダウンロード
                </button>
              </div>
              <textarea
                className="ocr-output"
                value={text}
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
