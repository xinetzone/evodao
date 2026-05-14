# push-to-github.ps1 — One-click GitHub push for Enter.pro projects (Windows)
# Repo: git@github.com:xinetzone/evodao.git
# Usage: Right-click -> "Run with PowerShell"  OR  powershell -ExecutionPolicy Bypass -File push-to-github.ps1

$ErrorActionPreference = "Stop"

$GITHUB_REPO = "git@github.com:xinetzone/evodao.git"
$BRANCH = "main"

Write-Host "=== GitHub Push Script for Enter.pro (Windows) ===" -ForegroundColor Cyan
Write-Host "Target: $GITHUB_REPO ($BRANCH)"
Write-Host ""

# 1. Check Git is installed
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not installed." -ForegroundColor Red
    Write-Host "Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# 2. Check for SSH key, generate if missing
$sshKey = "$env:USERPROFILE\.ssh\id_ed25519"
$sshPub = "$env:USERPROFILE\.ssh\id_ed25519.pub"

if (-not (Test-Path $sshKey)) {
    Write-Host "No SSH key found. Generating ed25519 key..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ssh" | Out-Null
    ssh-keygen -t ed25519 -C "enter-pro-push" -f $sshKey -N '""'
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ">>> ADD THIS PUBLIC KEY TO GITHUB:" -ForegroundColor Green
    Write-Host ">>> GitHub -> Settings -> SSH Keys -> New SSH Key" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Get-Content $sshPub
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green

    # Auto-open GitHub SSH settings page
    $open = Read-Host "Open GitHub SSH settings in browser? (Y/n)"
    if ($open -ne "n" -and $open -ne "N") {
        Start-Process "https://github.com/settings/ssh/new"
    }

    Read-Host "Press Enter after adding the key to GitHub"
} else {
    Write-Host "SSH key found: $sshKey" -ForegroundColor Green
}

# 3. Test SSH connection
Write-Host ""
Write-Host "Testing SSH connection to GitHub..."
$sshTest = ssh -T git@github.com -o StrictHostKeyChecking=no 2>&1
Write-Host $sshTest

# 4. Configure remote
Write-Host ""
Write-Host "Configuring remote..."
git remote remove github 2>$null
git remote add github $GITHUB_REPO
Write-Host "Remote 'github' -> $GITHUB_REPO"

# 5. Show recent commits
Write-Host ""
Write-Host "Commits to push:" -ForegroundColor Cyan
git log --oneline -5

# 6. Push
Write-Host ""
Write-Host "Pushing to GitHub ($BRANCH)..." -ForegroundColor Cyan
git push github HEAD:${BRANCH} --force

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Done! View your repo at:" -ForegroundColor Green
Write-Host "https://github.com/xinetzone/evodao" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

Start-Process "https://github.com/xinetzone/evodao"
Read-Host "Press Enter to exit"
