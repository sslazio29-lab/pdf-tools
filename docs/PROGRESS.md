# 進捗ログ（PROGRESS）

> Claudeが作業のたびに更新する。新しい記録を上に追記する。

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
