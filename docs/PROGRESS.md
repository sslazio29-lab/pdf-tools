# 進捗ログ（PROGRESS）

> Claudeが作業のたびに更新する。新しい記録を上に追記する。

## 2026-06-15（その8: マイルストーン3 動作確認完了）
### 実施
- ブラウザ手動確認を実施し、ユーザーが抽出・分割（バラバラ / Nページごと）の動作を確認
- マイルストーン3を完了
- 開発サーバーを停止

### 学び・気づき
- 新規依存（jszip）導入直後はViteが依存を再最適化し、その際に開発サーバープロセスが終了することがある（`optimized dependencies changed. reloading`）。依存追加後はサーバー再起動が必要
- JBIG2圧縮画像を含むPDFはpdf.jsがサムネイル描画を一部スキップ（`Jbig2Error`）するが、pdf-libによる抽出・分割処理には影響しない

### 次にやること
- マイルストーン3完了。残タスクは GitHub Pages デプロイ設定（後回し可）、およびバックログ（ページ編集・圧縮・OCR・画像変換）

## 2026-06-15（その7: 分割機能の追加 — 複数ファイル出力）
### 実施
- ユーザーの期待（「分割＝複数ファイルに分かれる」）に合わせ、分割モードを追加
- 依存追加: `jszip`（複数PDFをZIP化、脆弱性0）
- `src/lib/splitPdf.ts` に追加・整理
  - `splitIntoPages(file)`: 全ページを1ページずつ単独PDF化（`元名_p1.pdf` …）
  - `splitIntoChunks(file, size)`: Nページごとに区切る（`元名_1.pdf` …）
  - 共通ヘルパー `loadDocument` / `buildPdf` / `baseName` を切り出し、`extractPages` も再利用するよう整理
- `src/lib/zip.ts`: `downloadZip(files, zipName)` を新規作成（JSZip）
- `src/SplitView.tsx`: 出力モード切替（選択ページ抽出 / 全ページバラバラ / Nページごと）を追加
  - 抽出モード時のみサムネイル選択・範囲指定が有効。他モードではサムネイルはプレビュー表示
- `src/App.css`: モード切替ボタン・チャンク入力のスタイル追加
- `npm run lint` エラーなし、`npm run build` 成功（index.js 394KB gzip、SPEC目標2MB以内）

### 学び・気づき
- 「分割」は人によって期待が分かれる（抽出 vs 複数ファイル化）。SPEC文言だけで判断せず、UI設計前に動作パターンを確認すべきだった
- 複数ファイルのブラウザ一括DLはZIP化が安定（個別`a.click()`連打はブラウザにブロックされやすい）

### 次にやること
- ブラウザでの分割（バラバラ / Nページごと）とZIP中身の手動確認

## 2026-06-15（その6: マイルストーン3 分割・抽出機能の実装）
### 実施
- 抽出ロジック `src/lib/splitPdf.ts` を作成
  - `extractPages(file, pageNumbers)`: pdf-lib `copyPages` で選択ページのみの新規PDFを生成
  - `parsePageRange("1-3,5", total)`: 範囲指定文字列を1始まりページ配列に変換（重複除去・昇順・範囲外除外）
- サムネイル生成 `src/lib/renderThumbnails.ts` を作成
  - pdf.js で各ページを canvas→dataURL 化。worker は `?url` import で遅延読込
- UIをタブ化
  - `src/App.tsx` を「結合 / 分割・抽出」のタブシェルに変更
  - 既存結合UIは `src/MergeView.tsx` に分離（ロジック変更なし）
  - `src/SplitView.tsx` を新規作成: 1ファイル選択→サムネイルグリッド→クリック選択/範囲指定→抽出ダウンロード
  - `formatSize` を `src/lib/format.ts` に共通化
- `src/App.css` にタブ・サムネイルグリッド・範囲入力のスタイルを追加
- `npm run lint` エラーなし、`npm run build` 成功（index.js 364KB gzip、worker 1.2MBは別チャンクで分割タブ利用時のみ読込）

### 学び・気づき
- pdfjs-dist v6 では `destroy()` は `PDFDocumentProxy` ではなく `getDocument()` が返す loadingTask 側にある。型エラー回避のため loadingTask を保持して `loadingTask.destroy()` を呼ぶ
- pdf.js worker は `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` で Vite が最終URLに解決。別チャンク化され初期JSには含まれない

### 次にやること
- ブラウザでの抽出動作の手動確認（実PDFで検証）
- 確認後、マイルストーン3を完了とし、必要ならGitHub Pagesデプロイ設定へ

## 2026-06-15（その5: 結合機能の動作確認完了）
### 実施
- 開発サーバーでブラウザ手動確認を実施し、ユーザーが以下を確認:
  - D&D/クリック選択、一覧表示、並べ替え（↑↓/削除）、結合ダウンロード、選択順での結合
- マイルストーン2を完了（動作確認まで）
- 開発サーバーを停止

### 学び・気づき
- Windowsのプロセス停止等は Bash 経由だと `$_` や `{}` がbashに解釈され文字化けする。PowerShellツールを直接使うこと

### 次にやること
- マイルストーン3（分割・抽出）の計画提示と承認取得

## 2026-06-15（その4: マイルストーン2 結合機能の実装）
### 実施
- gitリポジトリを初期化し初期コミットを作成（`.env` を `.gitignore` に追加）
- 結合ロジックを `src/lib/mergePdf.ts` に分離
  - `pdf-lib` の `PDFDocument.create/load/copyPages/addPage` で結合
  - 破損・暗号化PDFは読込失敗時にファイル名付きエラー
  - `downloadPdf` でBlob化→`a[download]`保存
- `src/App.tsx` を結合UIに置換
  - D&D + クリックでのファイル選択、PDF以外を除外
  - 一覧表示（番号・名前・サイズ）、上へ/下へ/削除、すべてクリア
  - 2件未満は結合ボタンを無効化、結合中表示、エラー表示
- テンプレート資産を整理（react/vite/hero/icons.svg、`.counter` CSS、`#root` 固定幅）
- `index.html` の title/lang を日本語アプリ用に修正
- `npm run build` 成功（js 237KB gzip）、`npm run lint` エラーなし

### 学び・気づき
- `Blob([bytes], ...)` は TS で `BlobPart` への明示キャストが必要（Uint8Array をそのまま渡すと型エラーの可能性）
- pdf-lib 同梱で初期JSは237KB gzip。SPEC目標2MB以内に収まる

### 次にやること
- ブラウザでの結合動作の手動確認（実PDFで検証）
- 確認後、マイルストーン3（分割・抽出）の計画提示

## 2026-06-15（その3: 開発サーバー確認）
### 実施
- `vite --port 5174` で開発サーバーを起動し、`http://localhost:5174/` が HTTP 200 を返すことを確認
- マイルストーン1の残タスク「開発サーバー起動確認」を完了に更新

### 次にやること
- マイルストーン2（結合機能）の実装。まず計画を提示し承認を得る

## 2026-06-15（その2: 環境セットアップ）
### 実施
- Node.js v24.14.1 / npm 11.11.0 を確認
- Vite + React + TypeScript の最小プロジェクトを現フォルダ直下に作成
  - 一時フォルダ `.vite-tmp` に生成 → 中身を移動 → 一時フォルダ削除（既存docs/CLAUDE.mdとの競合回避）
- `pdf-lib` `pdfjs-dist` を導入（脆弱性0）
- `npm run build` 成功（初期バンドル js 約60KB gzip）
- `package.json` の name を `vite-tmp` → `pdf-tools` に修正

### 学び・気づき
- Bashツールでは PowerShell コマンド（Get-ChildItem等）は使えない。Windowsのファイル操作はPowerShellツールを使う
- 非空フォルダへの Vite scaffold は競合するため「一時フォルダ生成→移動」が安全
- PowerShell の `Move-Item *` はドットファイル（.gitignore）も移動する

### 次にやること
- `npm run dev` で開発サーバー起動確認
- その後マイルストーン2（結合機能）の計画提示

## 2026-06-15
### 実施
- 要件と方針を議論し確定:
  - Webアプリ / ブラウザ内処理 / GitHub Pages ホスティング
  - 中核機能は「結合」「分割・抽出」
  - OCRはブラウザ内（Tesseract.js）で将来実装、必要時のみ遅延読込
- プロジェクト統治ドキュメントを作成:
  - `CLAUDE.md`（不変ルール、改変禁止）
  - `docs/SPEC.md`（設計・仕様、編集は許可制）
  - `docs/TASKS.md`（タスク一覧）
  - `docs/PROGRESS.md`（本ファイル）

### 決定事項
- アプリ形態: Webアプリ
- 処理場所: 原則ブラウザ内で完結
- ホスティング: GitHub Pages（無料）
- 技術スタック（暫定）: Vite + React + TypeScript + pdf-lib + pdf.js

### 学び・気づき
- （特になし）

### 次にやること
- マイルストーン1（環境セットアップ）の計画提示と承認取得
