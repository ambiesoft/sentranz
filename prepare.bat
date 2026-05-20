set PATH=%PATH:C:\Linkout\bat;=%
call C:\Linkout\bat\envrust.bat
call C:\Linkout\bat\envnode.bat
call C:\Linkout\bat\envllvm

REM Set the path to the LLVM binaries for libclang
REM to build some rust libraries.
set LIBCLANG_PATH=C:\local\llvm\bin

