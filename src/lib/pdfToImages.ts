import * as pdfjs from 'pdfjs-dist'
// Vite はこの ?url import を worker ファイルの最終URLに解決する（遅延読込）。
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** 出力する画像形式。 */
export type ImageFormat = 'png' | 'jpeg'

/** 変換結果の1ファイル分（ZIP化用）。 */
export type ImageFile = {
  name: string
  blob: Blob
}

/** 変換の進捗。UI更新用。 */
export type ConvertProgress = {
  /** 処理中のページ番号（1始まり） */
  page: number
  /** 総ページ数 */
  total: number
}

/**
 * pdf.js の getDocument に渡す描画リソースの配信URL設定を組み立てる。
 * cMap/standard_fonts/wasm を渡さないと文字やスキャン画像が描画されず空白になる。
 * BASE_URL 前置で GitHub Pages のサブパス配信にも対応する。
 */
function documentParams(bytes: ArrayBuffer) {
  const base = import.meta.env.BASE_URL
  return {
    data: new Uint8Array(bytes),
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
  }
}

/** canvas を指定形式の Blob に変換する。 */
function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat): Promise<Blob> {
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const quality = format === 'jpeg' ? 0.92 : undefined
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('画像の生成に失敗しました'))
      },
      mime,
      quality,
    )
  })
}

/**
 * PDFの各ページを画像（PNG/JPEG）に変換する。
 * すべてブラウザ内で処理し、外部にデータを送信しない。
 *
 * @param file 対象のPDFファイル
 * @param format 出力画像形式（png / jpeg）
 * @param scale 描画スケール（大きいほど高解像度・重い）。既定 2.0
 * @param onProgress 進捗コールバック（任意）
 * @returns ページ順の画像ファイル配列（index 0 = 1ページ目）
 */
export async function pdfToImages(
  file: File,
  format: ImageFormat,
  scale = 2.0,
  onProgress?: (p: ConvertProgress) => void,
): Promise<ImageFile[]> {
  const base = file.name.replace(/\.pdf$/i, '')
  const ext = format === 'jpeg' ? 'jpg' : 'png'
  const bytes = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument(documentParams(bytes))
  let pdf: Awaited<typeof loadingTask.promise>
  try {
    pdf = await loadingTask.promise
  } catch {
    throw new Error(
      `「${file.name}」を読み込めませんでした。PDFが破損しているか、暗号化されている可能性があります`,
    )
  }

  const results: ImageFile[] = []
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress?.({ page: pageNum, total: pdf.numPages })
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('ページの描画に失敗しました（canvas未対応）')
      }
      // JPEGは透過を持てないため、背景を白で塗ってから描画する
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      const blob = await canvasToBlob(canvas, format)
      results.push({ name: `${base}_p${pageNum}.${ext}`, blob })
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return results
}
