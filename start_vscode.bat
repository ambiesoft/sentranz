IF NOT EXIST "%~dp0prepare.bat" (
  echo prepare.bat not exit
  pause
  exit 1
)

call "%~dp0prepare.bat"
start "" C:\local\VSCode\Code.exe "%~dp0"

