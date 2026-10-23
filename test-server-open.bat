@echo off
chcp 65001 > nul
setlocal

cd /d "%~dp0"

set "PORT=3000"
set "URL=http://localhost:%PORT%"

echo ==================================================
echo   🏊 GMDC 로컬 테스트 서버 실행 (Port: %PORT%)
echo ==================================================

where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않거나 PATH에 등록되어 있지 않습니다.
    pause
    exit /b 1
)

if not exist "server.js" (
    echo [오류] 현재 경로에서 server.js 파일을 찾을 수 없습니다.
    pause
    exit /b 1
)

:: 기존 3000번 포트 사용 프로세스 확인 및 종료
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
    if not "%%a"=="0" (
        echo [안내] 기존 %PORT%번 포트 프로세스(PID: %%a^)를 종료합니다...
        taskkill /f /pid %%a >nul 2>nul
    )
)

echo [안내] 브라우저에서 %URL% 페이지를 엽니다...
start "" "%URL%"

echo [안내] 서버를 시작합니다. (종료하려면 창을 닫거나 Ctrl+C를 누르세요)
node server.js

pause
