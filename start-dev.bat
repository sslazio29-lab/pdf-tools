@echo off
rem PDFツール 開発サーバー起動バッチ
rem ダブルクリックで開発サーバーを起動し、既定ブラウザで開きます。
cd /d "%~dp0"

rem 依存が未インストールなら自動でインストール
if not exist "node_modules" (
  echo node_modules が見つかりません。npm install を実行します...
  call npm install
)

rem 起動から少し待ってブラウザを開く（サーバー本体はこのウィンドウで動き続けます）
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:5174/"

echo 開発サーバーを起動します。停止するには Ctrl+C を押してください。
call npm run dev -- --port 5174
