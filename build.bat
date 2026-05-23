call "%~dp0prepare.bat"
call npm run tauri build

if %errorlevel% neq 0 (
  pause
)
