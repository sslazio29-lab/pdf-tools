// pdf.js の描画に必要なリソースを node_modules から public/ へコピーする。
// public/ 配下は Vite が dev でも build でもそのまま配信するため、
// 開発サーバー・本番ビルドの双方で確実に参照できる。
//
//  - cmaps:          日本語(CJK)テキスト描画用の文字対応表
//  - standard_fonts: 標準フォント(Helvetica等)描画用
//  - wasm:           JBIG2/JPEG2000圧縮画像(スキャンPDF等)のデコード用
//
// predev / prebuild から自動実行される（package.json 参照）。
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/pdfjs-dist')
const dest = resolve(root, 'public')

const dirs = ['cmaps', 'standard_fonts', 'wasm']

if (!existsSync(src)) {
  console.error('[copy-pdfjs-assets] pdfjs-dist が見つかりません。npm install を実行してください。')
  process.exit(1)
}

mkdirSync(dest, { recursive: true })
for (const dir of dirs) {
  cpSync(resolve(src, dir), resolve(dest, dir), { recursive: true })
}

console.log(`[copy-pdfjs-assets] ${dirs.join(', ')} を public/ へコピーしました`)
