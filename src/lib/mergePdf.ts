import { PDFDocument } from 'pdf-lib'

/**
 * 複数のPDFファイルを渡された順序で1つに結合する。
 * すべてブラウザ内で処理し、外部にデータを送信しない。
 *
 * @param files 結合対象のPDFファイル（表示順 = 結合順）
 * @returns 結合後PDFのバイト列（Uint8Array）
 */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error('結合するPDFが選択されていません')
  }

  const merged = await PDFDocument.create()

  for (const file of files) {
    const bytes = await file.arrayBuffer()
    let src: PDFDocument
    try {
      src = await PDFDocument.load(bytes)
    } catch {
      throw new Error(`「${file.name}」を読み込めませんでした。PDFが破損しているか、暗号化されている可能性があります`)
    }
    const pages = await merged.copyPages(src, src.getPageIndices())
    for (const page of pages) {
      merged.addPage(page)
    }
  }

  return merged.save()
}

/**
 * バイト列をBlob化し、ブラウザでダウンロードさせる。
 */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
