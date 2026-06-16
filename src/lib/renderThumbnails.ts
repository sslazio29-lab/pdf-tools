import * as pdfjs from 'pdfjs-dist'
// Vite はこの ?url import を worker ファイルの最終URLに解決する。
// 遅延読込のため、worker は本モジュールが読み込まれて初めて参照される。
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * pdf.js の getDocument に渡す描画リソースの配信URL設定を組み立てる。
 * これらを渡さないと描画が欠ける:
 *  - cMapUrl/standardFontDataUrl: 文字が描画されず空白になる
 *  - wasmUrl: JBIG2/JPEG2000圧縮画像(スキャンPDF等)がデコードできず空白になる
 * BASE_URL を前置することで GitHub Pages のサブパス配信にも対応する。
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

/** 1ページを指定スケールで描画し dataURL を返す共通処理。 */
async function renderPageToDataUrl(
  pdf: pdfjs.PDFDocumentProxy,
  pageNum: number,
  scale: number,
): Promise<string> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('ページの描画に失敗しました（canvas未対応）')
  }
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  const url = canvas.toDataURL('image/png')
  page.cleanup()
  return url
}

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
  const loadingTask = pdfjs.getDocument(documentParams(bytes))
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
      thumbnails.push(await renderPageToDataUrl(pdf, pageNum, scale))
    }
  } finally {
    await loadingTask.destroy()
  }

  return thumbnails
}

/**
 * 1ページだけを高解像度で描画する（拡大プレビュー用）。
 * 都度ドキュメントを開いて対象ページのみ描画し、loadingTask を破棄する。
 *
 * @param file 対象のPDFファイル
 * @param pageNum 1始まりのページ番号
 * @param scale 描画スケール。既定 2.0（サムネイルより鮮明）
 * @returns 当該ページの dataURL
 */
export async function renderPage(
  file: File,
  pageNum: number,
  scale = 2.0,
): Promise<string> {
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
  try {
    return await renderPageToDataUrl(pdf, pageNum, scale)
  } finally {
    await loadingTask.destroy()
  }
}
