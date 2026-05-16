set PATH=%PATH:C:\Linkout\bat;=%
call C:\Linkout\bat\envrust.bat
call C:\Linkout\bat\envnode.bat

start "" C:\local\VSCode\Code.exe "%~dp0"

