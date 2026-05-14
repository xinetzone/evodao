@echo off
REM push-to-github.bat — One-click GitHub push for Enter.pro projects (Windows CMD)
REM Repo: git@github.com:xinetzone/evodao.git
REM Usage: Double-click this file, or run in CMD

setlocal

set GITHUB_REPO=git@github.com:xinetzone/evodao.git
set BRANCH=main

echo === GitHub Push Script for Enter.pro (Windows) ===
echo Target: %GITHUB_REPO% (%BRANCH%)
echo.

REM 1. Check Git
where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed.
    echo Download from: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM 2. Check SSH key
if not exist "%USERPROFILE%\.ssh\id_ed25519" (
    echo No SSH key found. Generating ed25519 key...
    if not exist "%USERPROFILE%\.ssh" mkdir "%USERPROFILE%\.ssh"
    ssh-keygen -t ed25519 -C "enter-pro-push" -f "%USERPROFILE%\.ssh\id_ed25519" -N ""
    echo.
    echo ==========================================
    echo >>> ADD THIS PUBLIC KEY TO GITHUB:
    echo >>> GitHub -^> Settings -^> SSH Keys -^> New SSH Key
    echo ==========================================
    echo.
    type "%USERPROFILE%\.ssh\id_ed25519.pub"
    echo.
    echo ==========================================
    echo Opening GitHub SSH settings in browser...
    start https://github.com/settings/ssh/new
    pause
) else (
    echo SSH key found: %USERPROFILE%\.ssh\id_ed25519
)

REM 3. Test SSH connection
echo.
echo Testing SSH connection to GitHub...
ssh -T git@github.com -o StrictHostKeyChecking=no

REM 4. Configure remote
echo.
echo Configuring remote...
git remote remove github 2>nul
git remote add github %GITHUB_REPO%
echo Remote 'github' -^> %GITHUB_REPO%

REM 5. Show recent commits
echo.
echo Commits to push:
git log --oneline -5

REM 6. Push
echo.
echo Pushing to GitHub (%BRANCH%)...
git push github HEAD:%BRANCH% --force

echo.
echo ==========================================
echo Done! View your repo at:
echo https://github.com/xinetzone/evodao
echo ==========================================
start https://github.com/xinetzone/evodao

pause
