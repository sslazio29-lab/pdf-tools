@echo off
rem PDF Tools - start the dev server.
rem ASCII-only on purpose: Japanese comments break under cmd.exe's CP932 codepage.
rem Double-click this file, or run it from a terminal.
cd /d "%~dp0"

rem Install dependencies on first run.
if not exist "node_modules" (
  echo node_modules not found. Running npm install...
  call npm install
)

echo Starting dev server. The browser opens automatically when it is ready.
echo Press Ctrl+C to stop.

rem --open lets Vite open the correct URL only after the server is ready,
rem so there is no fixed-delay / fixed-port race.
call npm run dev -- --port 5174 --open
