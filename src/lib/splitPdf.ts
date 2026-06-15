import { PDFDocument } from 'pdf-lib'

/**
 * 指定したページのみを抽出して新しいPDFを作る。
 * すべてブラウザ内で処理し、外部にデータを送信しない。
 *
 * @param file 元のPDFファイル
 * @param pageNumbers 抽出する1始まりのページ番号（表示順に並んでいる前提）
 * @returns 抽出後PDFのバイト列（Uint8Array）
 */
export async function extractPages(
  file: File,
  pageNumbers: number[],
): Promise<Uint8Array> {
  if (pageNumbers.length === 0) {
    throw new Error('抽出するページが選択されていません')
  }

  const src = await loadDocument(file)
  const total = src.getPageCount()
  // 1始まり → 0始まりに変換し、範囲外を除外
  const indices = pageNumbers
    .map((n) => n - 1)
    .filter((i) => i >= 0 && i < total)
  if (indices.length === 0) {
    throw new Error('有効なページが選択されていません')
  }

  return buildPdf(src, indices)
}

/** 分割結果の1ファイル分。ZIP化やダウンロードに使う。 */
export type SplitFile = {
  name: string
  bytes: Uint8Array
}

/** 連続するインデックス範囲を新規PDFにコピーしてバイト列にする内部ヘルパー。 */
async function buildPdf(src: PDFDocument, indices: number[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, indices)
  for (const page of pages) {
    out.addPage(page)
  }
  return out.save()
}

/** ファイルを読み込み PDFDocument を返す内部ヘルパー（失敗時はファイル名付きエラー）。 */
async function loadDocument(file: File): Promise<PDFDocument> {
  const bytes = await file.arrayBuffer()
  try {
    return await PDFDocument.load(bytes)
  } catch {
    throw new Error(
      `「${file.name}」を読み込めませんでした。PDFが破損しているか、暗号化されている可能性があります`,
    )
  }
}

/** 元ファイル名から拡張子を除いたベース名を取り出す。 */
function baseName(file: File): string {
  return file.name.replace(/\.pdf$/i, '')
}

/**
 * 全ページを1ページずつ単独のPDFに分割する。
 *
 * @returns ページ順の分割ファイル配列（`元名_p1.pdf` …）
 */
export async function splitIntoPages(file: File): Promise<SplitFile[]> {
  const src = await loadDocument(file)
  const total = src.getPageCount()
  const base = baseName(file)
  const result: SplitFile[] = []
  for (let i = 0; i < total; i++) {
    const bytes = await buildPdf(src, [i])
    result.push({ name: `${base}_p${i + 1}.pdf`, bytes })
  }
  return result
}

/**
 * Nページごとに区切って複数のPDFに分割する。
 *
 * @param size 1ファイルあたりのページ数（1以上）
 * @returns 分割ファイル配列（`元名_1.pdf` …）
 */
export async function splitIntoChunks(file: File, size: number): Promise<SplitFile[]> {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('1ファイルあたりのページ数は1以上の整数で指定してください')
  }
  const src = await loadDocument(file)
  const total = src.getPageCount()
  const base = baseName(file)
  const result: SplitFile[] = []
  let part = 1
  for (let start = 0; start < total; start += size) {
    const indices: number[] = []
    for (let i = start; i < Math.min(start + size, total); i++) {
      indices.push(i)
    }
    const bytes = await buildPdf(src, indices)
    result.push({ name: `${base}_${part}.pdf`, bytes })
    part++
  }
  return result
}

/**
 * 「1-3,5,8-10」のような範囲指定文字列を1始まりのページ番号配列に変換する。
 * 重複は除去し、昇順に並べ替える。範囲外チェックは呼び出し側で行う想定。
 *
 * @param input 範囲指定文字列
 * @param total 総ページ数（上限チェック用）
 */
export function parsePageRange(input: string, total: number): number[] {
  const result = new Set<number>()
  const parts = input.split(',')

  for (const raw of parts) {
    const part = raw.trim()
    if (part === '') continue

    const range = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      const lo = Math.min(start, end)
      const hi = Math.max(start, end)
      for (let n = lo; n <= hi; n++) {
        if (n >= 1 && n <= total) result.add(n)
      }
      continue
    }

    const single = part.match(/^\d+$/)
    if (single) {
      const n = Number(part)
      if (n >= 1 && n <= total) result.add(n)
      continue
    }

    throw new Error(`「${part}」は正しいページ指定ではありません（例: 1-3,5）`)
  }

  return [...result].sort((a, b) => a - b)
}
