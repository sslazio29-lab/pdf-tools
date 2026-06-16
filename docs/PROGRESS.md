# 進捗ログ（PROGRESS）

> Claudeが作業のたびに更新する。新しい記録を上に追記する。

## 2026-06-16（その18: マイルストーン6 画像⇔PDF変換）
### 実施
- OCRフェーズ2はユーザー確認済み。マイルストーン5完了。バックログ「画像⇔PDF変換」に着手（ユーザー承認、段階的に①画像→PDF→②PDF→画像）
- 方向①「画像→PDF」: `src/lib/imageToPdf.ts` を新規作成
  - `imagesToPdf(files)`: 複数のJPEG/PNGを選択順に1ページずつ配置した1PDFを生成。マジックバイト（0xFFD8）でJPEG判定し `embedJpg`/`embedPng`。ページ寸法は画像実寸（再エンコードなし＝劣化なし）。既存依存pdf-libのみ
  - `isSupportedImage(file)`: type または拡張子(.jpg/.jpeg/.png)で判定
- 方向②「PDF→画像」: `src/lib/pdfToImages.ts` を新規作成
  - `pdfToImages(file, format, scale, onProgress)`: pdf.jsで各ページ描画→`canvas.toBlob`でPNG/JPEG化。`renderThumbnails.ts`の`documentParams`（cMap/standard_fonts/wasm）を踏襲。JPEG時は透過対策に背景白塗り。`元名_pN.png/jpg`
- ZIP: `src/lib/zip.ts` に `downloadBlobsZip(files, zipName)` と共通`triggerZipDownload`を追加（既存`downloadZip`はUint8Array、新規はBlob対応）
- UI: `src/ConvertView.tsx` を新規作成。上部で「画像→PDF / PDF→画像」をmode-row切替。画像→PDFは複数追加・←→並べ替え・🗑削除（object URLで都度プレビュー、reset/削除時にrevoke）。PDF→画像はPNG/JPEG・高解像度チェック・進捗表示
- `App.tsx` に「画像⇔PDF変換」タブ追加
- `npm run lint` エラーなし、`npm run build` 成功（index.js 406KB gzip、SPEC目標2MB以内）

### 学び・気づき
- `.thumb-num`（position:absolute）は position 指定のある祖先が必要。`.page-card`は静的配置なので、番号バッジは relative な `.page-thumb` の中に置く
- 画像→PDFは pdf-lib の `embedJpg`/`embedPng` で再エンコード不要。ページ＝画像実寸にすれば劣化なし。JPEG/PNGの判別はMIMEが空のことがあるためマジックバイトが堅い
- canvas→画像は `toBlob`（非同期）。JPEGは透過非対応なので描画前に白背景を塗らないと透過部分が黒くなる
- 画像→PDF/PDF→画像は新規依存ゼロ（pdf-lib・pdf.js・jszipの既存資産で実装）

### 次にやること
- ブラウザで両方向（複数画像→PDF、PDF→PNG/JPEG ZIP、並べ替え・削除、高解像度）を手動確認
- 確認できればマイルストーン6完了。残バックログは「圧縮」とGitHub Pagesデプロイ

## 2026-06-16（その17: マイルストーン5 OCR フェーズ2 = 検索可能PDF生成）
### 実施
- フェーズ2に着手。方針は「tesseract.jsのPDF出力（画像＋透明テキスト層）を使い、CJKフォントのバンドルを回避」をユーザー承認のもと採用
- `src/lib/ocr.ts` を改修
  - 認識を1パスで `worker.recognize(image, {}, { text: true, pdf: true })` に変更し、.txt と 検索可能PDF を同時取得。戻り値を `{ text, pdfBytes }`（型 `OcrResult`）に
  - ページ原寸合わせのため `worker.setParameters({ user_defined_dpi: '180' })`（= 72 × OCR_SCALE 2.5）を設定
  - 各ページの1枚PDF（`data.pdf`）を `mergePagePdfs` で pdf-lib `copyPages` 結合 → `Uint8Array` を返す
  - `downloadPdfBytes` を追加し、`triggerDownload` 共通処理に集約
- `src/OCRView.tsx`: 状態を `text` → `result`（OcrResult）に。結果表示に「テキスト（.txt）」と「検索可能PDF（.pdf）をダウンロード」の2ボタン（`.ocr-actions`）。PDF名は `元名_検索可能.pdf`
- `src/App.css` に `.ocr-actions`（flex）を追加
- `npm run lint` エラーなし、`npm run build` 成功（index.js 404KB gzip、SPEC目標2MB以内）

### 学び・気づき
- tesseract.js v7 は `recognize(image, options, output)` の第3引数 `OutputFormats` で `{ text, pdf, hocr, tsv, ... }` を選べる。`pdf:true` で画像＋透明テキスト層の1ページPDFが `data.pdf`（number[]）として得られ、日本語テキスト層も内部生成されるためCJKフォント埋め込み不要
- 検索可能PDFのページ寸法は画像解像度に依存。pdf.js viewport scale 1 = 72dpi なので、scale 2.5描画は実180dpi。`user_defined_dpi` を 72×scale に合わせないと原寸とずれる
- 複数の1ページPDFの結合は既存依存の pdf-lib `copyPages` でそのまま可能

### 次にやること
- ブラウザで検索可能PDFをDLし、PDFビューアで「テキスト選択・全文検索（日本語）」が効くか確認
- 確認できればマイルストーン5を完了。残はバックログ（圧縮・画像変換）とGitHub Pagesデプロイ

## 2026-06-16（その16: マイルストーン5 OCR フェーズ1 = txt出力）
### 実施
- その15のライトボックス変更をコミット（`6117501`）。最初の `git commit -m @'...'@` はBashツールにPowerShellのヒアドキュメント構文を渡してしまい先頭・末尾に余分な `@` が混入。`--amend` で修正
- バックログ「OCR」に着手。ユーザー承認のもと段階的方針（まず軽い .txt 出力 → 後で検索可能PDF）で実装
- `tesseract.js` v7 を導入（脆弱性0）
- OCRロジック `src/lib/ocr.ts` を新規作成
  - `ocrPdf(file, onProgress)`: ページ数はpdf-libで取得、各ページを `renderPage`（pdf.js, scale 2.5）で描画→tesseract.jsで認識。言語は `jpn`+`eng`。ページ区切り付きテキストを返す
  - 進捗は tesseract の logger（`recognizing text` の progress）を現在ページ番号にクロージャで紐づけてコールバック
  - `downloadText(text, name)`: .txt をBlobでダウンロード
- OCR UI `src/OCRView.tsx` を新規作成（SplitViewのドロップゾーン/エラー/resetを踏襲）。実行ボタン・進捗ラベル・結果textarea・DLボタン
- `App.tsx` に「OCR（文字認識）」タブを追加、`App.css` に `.ocr-output` を追加
- `npm run lint` エラーなし、`npm run build` 成功（index.js 404KB gzip、SPEC目標2MB以内）

### 学び・気づき
- tesseract.js はエンジン(WASM)/言語データを実行時に既定CDNから取得する。よってViteバンドルへの影響は軽微。一方、完全オフライン/プライバシー厳密化には言語データのローカルホスティング（pdf.jsアセットと同様にpublic/へ）が必要。jpnは十数MBと重いため将来課題
- プライバシー表現は正確に切り分ける: ユーザーのPDFは外部送信しない／OCRエンジン・言語データの初回読込のみCDN取得、と明記した
- BashツールはPOSIXシェル。PowerShellの `@'...'@` ヒアドキュメントは通らない。複数行コミットは `-m` に通常の二重引用符を渡すのが無難

### 次にやること
- ブラウザ動作確認はユーザー完了（正しく動作）。完全オフライン化はコスト/帯域/保守の観点から見送り、現状維持（標準版言語データをCDN取得）に決定
- 精度メモ: ユーザー確認で「月→A」「拝啓→BE」等、日本語が半角英字に誤読される事例あり。fast版は精度がさらに落ちるため不採用。改善候補は (a) `jpn`単独化（engを外す）, (b) 描画スケール引き上げ（現状OCR_SCALE=2.5）, (c) PSM等のパラメータ調整。次回着手時に実PDFで比較
- その後フェーズ2（検索可能PDF=透明テキスト層の埋め込み）を検討

## 2026-06-16（その15: プレビュー強化 フェーズB 拡大プレビュー＝ライトボックス）
### 実施
- 前回（その14）のJBIG2 WASM修正がブラウザで表示されることをユーザー確認。フェーズBに着手
- `renderThumbnails.ts` をリファクタ: getDocument の描画リソース設定（cMap/standard_fonts/wasm）を `documentParams` に共通化し、1ページ描画を `renderPageToDataUrl` に切り出して二重管理を解消
- 単一ページを高解像度（既定 scale 2.0）で描画する `renderPage(file, pageNum, scale)` を新設（拡大プレビュー用に都度ドキュメントを開いて当該ページのみ描画）
- 共通コンポーネント `src/Lightbox.tsx` を新規作成: 全画面オーバーレイ、背景/✕/ESCで閉じる、‹›ボタンとキーボード←→でページ送り、`role="dialog"`/`aria-modal`対応
  - 表示中に対象ページを高解像度で再描画。生成までは fallback（サムネイル）＋「高画質を生成中…」を表示
  - 高解像度結果は `{ srcPageNum, url }` で保持し isRendering を派生で算出（effect内の同期setStateを避け cascading renders を回避）
- SplitView・EditView の各サムネイルに🔍拡大ボタンを追加（SplitViewはサムネイルクリック＝選択と競合しないよう別ボタン化、`.thumb-wrap`でラップ）。EditViewは回転角をプレビューにも反映
- `App.css` に拡大ボタン・ライトボックスのスタイルを追加
- `npm run lint` エラーなし、`npm run build` 成功（index.js 396KB gzip、SPEC目標2MB以内）。ブラウザ手動確認完了（拡大・回転反映・ページ送り・閉じる）

### 学び・気づき
- eslint(react-hooks)は effect 本体での同期 setState を `set-state-in-effect` で弾く。「描画結果＋対象ページ番号」をセットで保持し、ローディング状態は派生で求めると同期setStateを消せる
- 全角スペースはeslintの `no-irregular-whitespace` に触れる。間隔はCSS（margin）で取る
- 拡大は都度 getDocument する素朴実装。現状の用途では十分だが、連続ページ送りで毎回開き直すコストはある。重くなったら loadingThumbnailの段で開いた pdf を使い回す設計に変える余地あり

### 次にやること
- プレビュー強化は完了。残はバックログ（圧縮・OCR・画像変換）とGitHub Pages デプロイ設定。優先度はユーザーと相談

## 2026-06-15（その14: サムネイル空白の真因＝JBIG2 WASM未設定を修正、配信方式をpublic/へ変更）
### 実施
- ユーザー報告「まだ読めない」を受け開発サーバーのコンソールログを確認。真因が判明:
  - 対象PDFはスキャン文書で、ページ実体が JBIG2圧縮の白黒スキャン画像（＝文字に見えるものは実テキストではなく画像）
  - pdf.js v6 は JBIG2/JPEG2000 のデコードに WASM が必要だが `wasmUrl` 未指定で `Jbig2Error: JBig2 failed to initialize` → ページが空白に。赤い印影は別コーデックの画像なので見えていた
  - 前回のCMap対応はテキストPDF向けには正しいが、この文書の主因ではなかった
- 配信方式を見直し: `vite-plugin-static-copy` はグロブ展開が期待どおり動かず（`node_modules`構造を保持／dest解決が不安定）アンインストール
- 代わりに `scripts/copy-pdfjs-assets.mjs`（Node `cpSync`）で `pdfjs-dist` の `cmaps`/`standard_fonts`/`wasm` を `public/` へコピー。Viteはpublic/をdev・build双方で素のまま配信するため確実
- `package.json` に `copy-pdfjs-assets` と `predev`/`prebuild` を追加（自動実行）
- `.gitignore` に `public/{cmaps,standard_fonts,wasm}` を追加（生成物のため非コミット）
- `renderThumbnails.ts` の `getDocument` に `wasmUrl: ${BASE_URL}wasm/` を追加（cMapUrl等は維持）
- ビルド成功。dev配信を実バイトで検証（wasm 104852B/application/wasm、cmap 40951B、font 139512B）

### 学び・気づき
- pdf.jsで「文字が出ない」原因は2系統ある。①実テキストPDF→CMap/standard_fonts未設定、②スキャンPDF→JBIG2/JPEG2000のWASM未設定。コンソールログで切り分けること（推測でCMapだけ対応して外した反省）
- 静的アセットの確実な配信はVite標準の`public/`が堅い。プラグインのグロブ挙動でハマるより、明示的なコピースクリプト＋predev/prebuildが見通しがよい
- 配信検証は「200か」だけでなくContent-Typeと実バイト数まで見る。SPAフォールバックが200でindex.html(text/html, 626B)を返すため、200でも誤判定する

### 次にやること
- ブラウザでスキャンPDFのサムネイルに文字（スキャン画像）が表示されるか確認
- 確認後フェーズB（クリックで拡大プレビュー）へ

## 2026-06-15（その13: サムネイルで日本語が表示されない不具合の修正）
### 実施
- 症状: サムネイルで文字がほぼ見えず、押印（赤い画像）だけ見える、とユーザー報告
- 原因特定: pdf.js は CJK 文字描画に CMap、標準フォント描画に standard_fonts を別途必要とする。`getDocument` にこれらのURLを渡していなかったため、日本語テキストが描画されず空白になっていた（画像は描画される）
- `vite-plugin-static-copy`（devDep、脆弱性0）を導入し、`pdfjs-dist/cmaps` と `pdfjs-dist/standard_fonts` を配信成果物へコピー
- `renderThumbnails.ts` の `getDocument` に `cMapUrl`/`cMapPacked:true`/`standardFontDataUrl` を追加。URLは `import.meta.env.BASE_URL` を前置し GitHub Pages のサブパス配信にも対応
- `npm run lint` エラーなし、`npm run build` 成功（Copied 185 items、index.js 395KB gzip）

### 学び・気づき
- pdf.js でサムネイルに日本語が出ない場合、解像度ではなく CMap/standard_fonts 未設定を疑う。画像だけ見えて文字が消えるのが典型症状
- 抽出/分割/結合/回転は pdf-lib 担当でフォント描画に非依存。今回の不具合は表示のみで、出力PDFは正常

### 次にやること
- ブラウザで同じ日本語PDFのサムネイルに文字が表示されるか確認
- 確認後フェーズB（クリックで拡大プレビュー）へ

## 2026-06-15（その12: プレビュー強化 フェーズA サムネイルサイズ切替）
### 実施
- バックログ「プレビュー強化」に着手。フェーズA（サイズ切替）を実装
- `renderThumbnails` の基準スケールを 0.4 → 0.6 に引き上げ（拡大時の鮮明さ確保）
- 共通コンポーネント `src/SizeToggle.tsx` を新規作成（小/中/大、radiogroup）
- `src/App.css` に `.thumb-grid.size-sm/md/lg`（列幅 90/140/220px）とトグルのスタイルを追加。既定の列幅も 110px → 140px に
- SplitView・EditView 双方に `thumbSize` 状態とトグルを追加し、`thumb-grid` に `size-${thumbSize}` を付与
- `npm run lint` エラーなし、`npm run build` 成功（index.js 395KB gzip、SPEC目標2MB以内）

### 学び・気づき
- App.css は `var(--muted)` を使えない（index.css に未定義）。muted系の色は `var(--text)` を使う

### 次にやること
- フェーズAをブラウザで手動確認（小/中/大の切替、大でも鮮明か）
- 確認後フェーズB（クリックで拡大プレビュー＝ライトボックス）を実装

## 2026-06-15（その11: マイルストーン4 動作確認完了）
### 実施
- ブラウザ手動確認を実施し、ユーザーがページ編集（並べ替え・回転・削除→保存）の動作を確認
- マイルストーン4を完了
- 課題: プレビューが弱い（サムネイルが小さい等）。バックログに「プレビュー強化」を追加

### 次にやること
- バックログ（プレビュー強化、圧縮、OCR、画像変換）。優先度はユーザーと相談
- GitHub Pages デプロイ設定（後回し可）

## 2026-06-15（その10: start-dev.bat の文字化けエラー修正）
### 実施
- ダブルクリックで「操作可能なプログラムではない」エラーが多発する不具合を調査
- 実走ログから原因特定: bat が UTF-8 保存なのに日本語版 cmd.exe が CP932 で読むため、日本語コメント/echo のバイト列が壊れ、行がコマンドとして誤実行されていた（dev サーバー自体は起動していたがエラーに埋もれていた）
- bat を ASCII のみで書き直し（文字コード非依存で堅牢化）
- 併せて「3秒待って固定URLを開く」ハックを廃止し、`vite --open` でサーバー準備完了後に正しいURLを自動で開く方式に変更（空白ページ・ポートずれも解消）

### 学び・気づき
- Windows用 .bat は ASCII のみで書くのが最も安全。日本語コメントを入れるなら CP932(Shift-JIS) で保存する必要がある。UTF-8 のままだと cmd が誤読してコメント行までコマンド実行してしまう
- PowerShell から bat を名前だけで実行すると「認識されません」になる（`.\` が必要）。ただし今回の真因はこれではなく、エンコーディングだった。推測で原因を断定せず、実走ログで確認すべきだった

## 2026-06-15（その9: マイルストーン4 ページ編集機能の実装）
### 実施
- SPEC第2段階「ページ編集（並べ替え・削除・回転）」を実装
- ロジック `src/lib/editPdf.ts` を新規作成
  - `buildEditedPdf(file, ops)`: 表示順のページ操作配列から編集後PDFを生成
  - pdf-lib `copyPages` 後、各ページに `setRotation(degrees(...))`。元の回転に加算し0〜359に正規化
- UI `src/EditView.tsx` を新規作成（SplitViewの読込・サムネイル・ドロップゾーンを踏襲）
  - 各ページに ←→（並べ替え）／⟳（90°回転）／🗑（削除）。回転はサムネイルにCSS `transform: rotate()` で即時反映
  - 状態は `{ id, srcIndex, rotation }[]` 配列。安定idで並べ替え・削除を安全に
  - 「すべてリセット」「編集を保存してダウンロード」
- `src/App.tsx` に「ページ編集」タブを追加（タブ分岐を三項→`&&`連結に変更）
- `src/App.css` に `.page-card` / `.page-thumb` / `.page-ops` スタイルを追加
- `npm run lint` エラーなし、`npm run build` 成功（index.js 395KB gzip、SPEC目標2MB以内）

### 学び・気づき
- 回転は元PDFのページ回転に加算する必要がある。`page.getRotation().angle` を基準に正規化しないと、既に回転済みのPDFで挙動がずれる
- 並べ替え・削除があるUIでは配列indexをkeyにすると不整合が起きるため、読込時に安定idを付与した

### 次にやること
- ブラウザでの並べ替え・回転・削除の手動確認（実PDFで検証）
- 確認後マイルストーン4を完了

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
