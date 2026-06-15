import { PDFDocument, degrees } from 'pdf-lib'

/** ページ編集の1ページ分の操作。表示順に並んだ配列で渡す。 */
export type PageOp = {
  /** 元PDFでの0始まりページインデックス */
  srcIndex: number
  /** 追加で適用する回転角（度・90の倍数）。元の回転に加算される */
  rotation: number
}

/**
 * 並べ替え・削除・回転を反映した新しいPDFを作る。
 * すべてブラウザ内で処理し、外部にデータを送信しない。
 *
 * @param file 元のPDFファイル
 * @param ops 出力したいページの操作配列（表示順。削除済みページは含めない）
 * @returns 編集後PDFのバイト列（Uint8Array）
 */
export async function buildEditedPdf(
  file: File,
  ops: PageOp[],
): Promise<Uint8Array> {
  if (ops.length === 0) {
    throw new Error('出力するページがありません')
  }

  const bytes = await file.arrayBuffer()
  let src: PDFDocument
  try {
    src = await PDFDocument.load(bytes)
  } catch {
    throw new Error(
      `「${file.name}」を読み込めませんでした。PDFが破損しているか、暗号化されている可能性があります`,
    )
  }

  const total = src.getPageCount()
  const indices = ops.map((op) => op.srcIndex)
  if (indices.some((i) => i < 0 || i >= total)) {
    throw new Error('ページの指定が不正です')
  }

  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, indices)
  copied.forEach((page, i) => {
    const added = ops[i].rotation
    if (added % 360 !== 0) {
      // 元の回転に加算し、0〜359に正規化する
      const base = page.getRotation().angle
      const next = (((base + added) % 360) + 360) % 360
      page.setRotation(degrees(next))
    }
    out.addPage(page)
  })

  return out.save()
}
