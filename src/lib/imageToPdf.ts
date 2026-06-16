import { PDFDocument } from 'pdf-lib'

/** 画像→PDF変換が受け付ける画像のMIMEタイプ。 */
const SUPPORTED_TYPES = ['image/jpeg', 'image/png']

/** 拡張子からの判定用（type が空のファイルへのフォールバック）。 */
const SUPPORTED_EXT = /\.(jpe?g|png)$/i

/** ファイルが対応画像（JPEG/PNG）かどうかを判定する。 */
export function isSupportedImage(file: File): boolean {
  return SUPPORTED_TYPES.includes(file.type) || SUPPORTED_EXT.test(file.name)
}

/** JPEGかどうか（マジックバイトで判定）。それ以外はPNGとして扱う。 */
function isJpeg(bytes: Uint8Array): boolean {
  // JPEG は 0xFF 0xD8 で始まる
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8
}

/**
 * 複数の画像（JPEG/PNG）を選択順に1ページずつ配置した1つのPDFを生成する。
 * 各ページのサイズは画像の実寸（ピクセル＝ポイント）に合わせ、再エンコードせず
 * そのまま埋め込むため画質は劣化しない。
 *
 * すべてブラウザ内で処理し、外部にデータを送信しない。
 *
 * @param files 変換する画像ファイル群（選択順）
 * @returns 生成したPDFのバイト列
 */
export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error('画像ファイルを選択してください')
  }

  const pdf = await PDFDocument.create()

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let image
    try {
      image = isJpeg(bytes) ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
    } catch {
      throw new Error(
        `「${file.name}」を読み込めませんでした。JPEGまたはPNG画像を選択してください`,
      )
    }
    const page = pdf.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }

  return pdf.save()
}
