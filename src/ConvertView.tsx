import { useRef, useState } from 'react'
import { imagesToPdf, isSupportedImage } from './lib/imageToPdf'
import { downloadPdfBytes } from './lib/ocr'
import { pdfToImages, type ConvertProgress, type ImageFormat } from './lib/pdfToImages'
import { downloadBlobsZip } from './lib/zip'

/** 変換方向: 画像→PDF / PDF→画像 */
type Direction = 'img2pdf' | 'pdf2img'

/** 画像プレビュー用（object URL を保持して解放する）。 */
type ImageItem = {
  file: File
  url: string
}

function ConvertView() {
  const [direction, setDirection] = useState<Direction>('img2pdf')

  // 画像→PDF 用
  const [images, setImages] = useState<ImageItem[]>([])

  // PDF→画像 用
  const [pdf, setPdf] = useState<File | null>(null)
  const [format, setFormat] = useState<ImageFormat>('png')
  const [highRes, setHighRes] = useState(false)
  const [progress, setProgress] = useState<ConvertProgress | null>(null)

  const [isWorking, setIsWorking] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  function switchDirection(d: Direction) {
    if (d === direction) return
    resetAll()
    setDirection(d)
  }

  function resetAll() {
    images.forEach((it) => URL.revokeObjectURL(it.url))
    setImages([])
    setPdf(null)
    setProgress(null)
    setError(null)
  }

  // ----- 画像→PDF -----
  function addImages(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const accepted = Array.from(fileList).filter(isSupportedImage)
    if (accepted.length === 0) {
      setError('JPEGまたはPNG画像を選択してください')
      return
    }
    setError(null)
    setImages((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ])
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const target = prev[index]
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  function moveImage(index: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev]
      const to = index + dir
      if (to < 0 || to >= next.length) return prev
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })
  }

  async function handleImagesToPdf() {
    if (images.length === 0) return
    setError(null)
    setIsWorking(true)
    try {
      const bytes = await imagesToPdf(images.map((it) => it.file))
      downloadPdfBytes(bytes, '画像から作成.pdf')
    } catch (e) {
      setError(e instanceof Error ? e.message : '変換中にエラーが発生しました')
    } finally {
      setIsWorking(false)
    }
  }

  // ----- PDF→画像 -----
  function loadPdf(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const f = Array.from(fileList).find(
      (x) => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'),
    )
    if (!f) {
      setError('PDFファイルを選択してください')
      return
    }
    setError(null)
    setPdf(f)
    setProgress(null)
  }

  async function handlePdfToImages() {
    if (!pdf) return
    setError(null)
    setProgress(null)
    setIsWorking(true)
    try {
      const scale = highRes ? 3.0 : 2.0
      const files = await pdfToImages(pdf, format, scale, setProgress)
      const base = pdf.name.replace(/\.pdf$/i, '')
      await downloadBlobsZip(files, `${base}_images.zip`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '変換中にエラーが発生しました')
    } finally {
      setIsWorking(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (direction === 'img2pdf') addImages(e.dataTransfer.files)
    else loadPdf(e.dataTransfer.files)
  }

  return (
    <>
      <p className="subtitle">
        画像とPDFを相互変換します。ファイルはブラウザ内で処理され、外部に送信されません。
      </p>

      <div className="mode-row" role="radiogroup" aria-label="変換方向">
        <button
          type="button"
          role="radio"
          aria-checked={direction === 'img2pdf'}
          className={`mode-btn${direction === 'img2pdf' ? ' active' : ''}`}
          onClick={() => switchDirection('img2pdf')}
        >
          画像 → PDF
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={direction === 'pdf2img'}
          className={`mode-btn${direction === 'pdf2img' ? ' active' : ''}`}
          onClick={() => switchDirection('pdf2img')}
        >
          PDF → 画像
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {/* ===== 画像 → PDF ===== */}
      {direction === 'img2pdf' && (
        <>
          <div
            className={`dropzone${isDragging ? ' dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => imgInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') imgInputRef.current?.click()
            }}
          >
            <p>ここに画像（JPEG/PNG）をドラッグ&amp;ドロップ</p>
            <p className="muted">またはクリックして選択（複数可・追加できます）</p>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              hidden
              onChange={(e) => {
                addImages(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {images.length > 0 && (
            <>
              <div className="thumb-grid size-md">
                {images.map((it, i) => (
                  <div className="page-card" key={it.url}>
                    <div className="page-thumb">
                      <img src={it.url} alt={it.file.name} loading="lazy" />
                      <span className="thumb-num">{i + 1}</span>
                    </div>
                    <div className="page-ops">
                      <button
                        type="button"
                        onClick={() => moveImage(i, -1)}
                        disabled={i === 0}
                        title="前へ"
                        aria-label="前へ移動"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(i, 1)}
                        disabled={i === images.length - 1}
                        title="後ろへ"
                        aria-label="後ろへ移動"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        title="削除"
                        aria-label="削除"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="toolbar">
                <span className="muted">{images.length}枚の画像</span>
                <div className="ocr-actions">
                  <button type="button" className="ghost" onClick={resetAll} disabled={isWorking}>
                    すべてクリア
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={handleImagesToPdf}
                    disabled={isWorking}
                  >
                    {isWorking ? '変換中…' : `${images.length}枚をPDFにまとめる`}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ===== PDF → 画像 ===== */}
      {direction === 'pdf2img' && (
        <>
          {!pdf && (
            <div
              className={`dropzone${isDragging ? ' dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => pdfInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') pdfInputRef.current?.click()
              }}
            >
              <p>ここにPDFをドラッグ&amp;ドロップ</p>
              <p className="muted">またはクリックして選択（1ファイル）</p>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => {
                  loadPdf(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>
          )}

          {pdf && (
            <>
              <div className="split-fileinfo">
                <span className="file-name" title={pdf.name}>
                  {pdf.name}
                </span>
                <button type="button" className="ghost" onClick={resetAll} disabled={isWorking}>
                  別のファイルを選ぶ
                </button>
              </div>

              <div className="range-row" role="radiogroup" aria-label="画像形式">
                <button
                  type="button"
                  role="radio"
                  aria-checked={format === 'png'}
                  className={`mode-btn${format === 'png' ? ' active' : ''}`}
                  onClick={() => setFormat('png')}
                >
                  PNG（高品質）
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={format === 'jpeg'}
                  className={`mode-btn${format === 'jpeg' ? ' active' : ''}`}
                  onClick={() => setFormat('jpeg')}
                >
                  JPEG（軽量）
                </button>
                <label className="chunk-label">
                  <input
                    type="checkbox"
                    checked={highRes}
                    onChange={(e) => setHighRes(e.target.checked)}
                  />
                  高解像度
                </label>
              </div>

              <div className="toolbar">
                <span className="muted">
                  {isWorking && progress
                    ? `${progress.page} / ${progress.total} ページ目を変換中…`
                    : isWorking
                      ? '変換中…'
                      : '各ページを画像化してZIPでダウンロードします'}
                </span>
                <button
                  type="button"
                  className="primary"
                  onClick={handlePdfToImages}
                  disabled={isWorking}
                >
                  {isWorking ? '変換中…' : '画像に変換してZIPダウンロード'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

export default ConvertView
