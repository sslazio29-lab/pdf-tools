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

/** OCRの結果。テキストと検索可能PDFの両方を持つ。 */
export type OcrResult = {
  /** ページ区切りを含む抽出テキスト */
  text: string
  /** 検索可能PDF（画像＋透明テキスト層）のバイト列 */
  pdfBytes: Uint8Array
}

/**
 * PDFの各ページをOCRし、抽出したテキストを返す。
 *
 * 処理はすべてブラウザ内で完結し、PDFの中身は外部に送信されない。
 * ただしOCRエンジン（WASM）と言語データの初回読込はtesseract.jsの
 * 既定CDNから取得する（ユーザーのファイルは送信しない）。
 *
 * @param file 対象のPDFファイル
 * @param onProgress 進捗コールバック（任意）
 * @returns 抽出テキストと検索可能PDFのバイト列
 */
export async function ocrPdf(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
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

  // 描画スケール(=2.5)は 72dpi のPDF点に対する倍率。検索可能PDFのページを
  // 原寸に合わせるため、画像の実解像度(72×スケール)をDPIとして渡す。
  await worker.setParameters({
    user_defined_dpi: String(Math.round(72 * OCR_SCALE)),
  })

  const parts: string[] = []
  const pagePdfs: Uint8Array[] = []
  try {
    for (let page = 1; page <= total; page++) {
      currentPage = page
      onProgress?.({ page, total, phase: 'render', ratio: 0 })
      const image = await renderPage(file, page, OCR_SCALE)
      // テキストと検索可能PDF（画像＋透明テキスト層）を1パスで取得
      const { data } = await worker.recognize(image, {}, { text: true, pdf: true })
      parts.push(`--- ${page}ページ ---\n${data.text.trim()}`)
      if (data.pdf) {
        pagePdfs.push(new Uint8Array(data.pdf))
      }
    }
  } finally {
    await worker.terminate()
  }

  const pdfBytes = await mergePagePdfs(pagePdfs)
  return { text: parts.join('\n\n'), pdfBytes }
}

/** ページごとの1枚PDFを1つの検索可能PDFに結合する。 */
async function mergePagePdfs(pagePdfs: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create()
  for (const bytes of pagePdfs) {
    const src = await PDFDocument.load(bytes)
    const copied = await merged.copyPages(src, src.getPageIndices())
    copied.forEach((p) => merged.addPage(p))
  }
  return merged.save()
}

/** 抽出テキストを .txt としてダウンロードする。 */
export function downloadText(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  triggerDownload(blob, fileName)
}

/** 検索可能PDFのバイト列を .pdf としてダウンロードする。 */
export function downloadPdfBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  triggerDownload(blob, fileName)
}

/** Blobを指定ファイル名でダウンロードさせる共通処理。 */
function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
