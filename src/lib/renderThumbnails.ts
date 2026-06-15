import * as pdfjs from 'pdfjs-dist'
// Vite はこの ?url import を worker ファイルの最終URLに解決する。
// 遅延読込のため、worker は本モジュールが読み込まれて初めて参照される。
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * PDFの各ページをサムネイル画像（dataURL）に変換する。
 * すべてブラウザ内で処理し、外部にデータを送信しない。
 *
 * @param file 対象のPDFファイル
 * @param scale 描画スケール（小さいほど軽い）。既定 0.6
 *   サイズ切替（大）でも鮮明さを保てるよう、やや高めに設定している。
 * @returns ページ順の dataURL 配列（index 0 = 1ページ目）
 */
export async function renderThumbnails(
  file: File,
  scale = 0.6,
): Promise<string[]> {
  const bytes = await file.arrayBuffer()
  // pdf.js の描画リソースの配信URL。これらを渡さないと描画が欠ける:
  //  - cMapUrl/standardFontDataUrl: 文字が描画されず空白になる
  //  - wasmUrl: JBIG2/JPEG2000圧縮画像(スキャンPDF等)がデコードできず空白になる
  // BASE_URL を前置することで GitHub Pages のサブパス配信にも対応する。
  const base = import.meta.env.BASE_URL
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
  })
  let pdf: Awaited<typeof loadingTask.promise>
  try {
    pdf = await loadingTask.promise
  } catch {
    throw new Error(
      `「${file.name}」を読み込めませんでした。PDFが破損しているか、暗号化されている可能性があります`,
    )
  }

  const thumbnails: string[] = []
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('サムネイルの描画に失敗しました（canvas未対応）')
      }
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      thumbnails.push(canvas.toDataURL('image/png'))
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return thumbnails
}
