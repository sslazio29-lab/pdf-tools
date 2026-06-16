import { PDFDocument } from 'pdf-lib'
import { createWorker } from 'tesseract.js'
import { renderPage } from './renderThumbnails'

/** OCRの進捗。UI更新用。 */
export type OcrProgress = {
  /** 処理中のページ番号（1始まり） */
  page: number
  /** 総ページ数 */
  total: number
  /** 現在の作業内容（描画 / 認識 など） */
  phase: 'render' | 'recognize'
  /** 認識フェーズの進捗 0〜1（描画フェーズは0） */
  ratio: number
}

/** OCRで使う言語。日本語＋英語（混在文書に対応）。 */
const LANGS = ['jpn', 'eng']

/** OCR時のページ描画スケール。認識精度のためサムネイルより高めにする。 */
const OCR_SCALE = 2.5

/**
 * PDFの各ページをOCRし、抽出したテキストを返す。
 *
 * 処理はすべてブラウザ内で完結し、PDFの中身は外部に送信されない。
 * ただしOCRエンジン（WASM）と言語データの初回読込はtesseract.jsの
 * 既定CDNから取得する（ユーザーのファイルは送信しない）。
 *
 * @param file 対象のPDFファイル
 * @param onProgress 進捗コールバック（任意）
 * @returns ページ区切りを含む抽出テキスト
 */
export async function ocrPdf(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  // ページ数の取得（pdf-libは結合・抽出でも使用している既存依存）
  const bytes = await file.arrayBuffer()
  let total: number
  try {
    const doc = await PDFDocument.load(bytes)
    total = doc.getPageCount()
  } catch {
    throw new Error(
      `「${file.name}」を読み込めませんでした。PDFが破損しているか、暗号化されている可能性があります`,
    )
  }
  if (total === 0) {
    throw new Error('ページが含まれていません')
  }

  // 認識フェーズの進捗を現在ページに紐づけるためのクロージャ変数
  let currentPage = 1
  const worker = await createWorker(LANGS, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.({
          page: currentPage,
          total,
          phase: 'recognize',
          ratio: m.progress,
        })
      }
    },
  })

  const parts: string[] = []
  try {
    for (let page = 1; page <= total; page++) {
      currentPage = page
      onProgress?.({ page, total, phase: 'render', ratio: 0 })
      const image = await renderPage(file, page, OCR_SCALE)
      const { data } = await worker.recognize(image)
      parts.push(`--- ${page}ページ ---\n${data.text.trim()}`)
    }
  } finally {
    await worker.terminate()
  }

  return parts.join('\n\n')
}

/** 抽出テキストを .txt としてダウンロードする。 */
export function downloadText(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
