import JSZip from 'jszip'
import type { SplitFile } from './splitPdf'

/**
 * 複数のPDFファイルをZIPにまとめてブラウザでダウンロードさせる。
 * すべてブラウザ内で処理し、外部にデータを送信しない。
 *
 * @param files まとめるファイル群
 * @param zipName 出力ZIPのファイル名
 */
export async function downloadZip(files: SplitFile[], zipName: string): Promise<void> {
  if (files.length === 0) {
    throw new Error('ダウンロードするファイルがありません')
  }

  const zip = new JSZip()
  for (const f of files) {
    zip.file(f.name, f.bytes)
  }
  const blob = await zip.generateAsync({ type: 'blob' })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = zipName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
