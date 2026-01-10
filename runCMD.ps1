Import-Module WebAdministration

# ============================
# CONFIG
# ============================
$AppPoolName = "PocusSchedualer"
$PublishPath = "E:\inetpub\wwwroot\simcenter\PocusSchedualer\api"
$RepoPath    = "E:\dev\simPocusSchedualerBackend\PocusSchedualer"

# ============================
# FUNCTIONS
# ============================

function Ensure-GitAvailable {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Git not found in PATH" -ForegroundColor Red
        return $false
    }
    return $true
}

function Git-PushFlow {

    if (-not (Ensure-GitAvailable)) {
        Pause
        return
    }

    if (-not (Test-Path $RepoPath)) {
        Write-Host "❌ Repo path not found: $RepoPath" -ForegroundColor Red
        Pause
        return
    }

    Push-Location $RepoPath

    try {
        if (-not (Test-Path ".git")) {
            Write-Host "❌ This folder is not a Git repository (.git missing)" -ForegroundColor Red
            Pause
            return
        }

        Write-Host ""
        Write-Host "📁 Repo: $RepoPath" -ForegroundColor Cyan
        Write-Host ""

        git status

        $changes = git status --porcelain
        if (-not $changes) {
            Write-Host ""
            Write-Host "ℹ️ No changes to commit." -ForegroundColor DarkYellow
            $push = Read-Host "Push anyway? (y/n)"
            if ($push -match '^(y|yes)$') {
                git push
            }
            Pause
            return
        }

        $msg = Read-Host "Commit message"
        if ([string]::IsNullOrWhiteSpace($msg)) {
            $msg = "Auto deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        }

        Write-Host ""
        Write-Host "➕ git add -A" -ForegroundColor Yellow
        git add -A

        Write-Host "📝 git commit" -ForegroundColor Yellow
        git commit -m $msg

        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Commit failed" -ForegroundColor Red
            Pause
            return
        }

        Write-Host "🚀 git push" -ForegroundColor Green
        git push

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Git push completed" -ForegroundColor Green
        } else {
            Write-Host "❌ Git push failed" -ForegroundColor Red
        }

        Pause
    }
    finally {
        Pop-Location
    }
}

# ============================
# MENU LOOP
# ============================

while ($true) {

    Clear-Host
    Write-Host "==================================" -ForegroundColor DarkCyan
    Write-Host "  PocusSchedualer Deployment Tool  " -ForegroundColor White
    Write-Host "==================================" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "1 - Stop AppPool + Publish"
    Write-Host "2 - Start AppPool"
    Write-Host "3 - Stop AppPool only"
    Write-Host "4 - Git: Add + Commit + Push"
    Write-Host "5 - Exit"
    Write-Host ""

    $choice = Read-Host "Choose option"

    switch ($choice) {

        "1" {
            Write-Host ""
            Write-Host "⛔ Stopping Application Pool..." -ForegroundColor Yellow
            Stop-WebAppPool -Name $AppPoolName -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3

            Write-Host "📦 Publishing (.NET)..." -ForegroundColor Cyan
            dotnet publish -c Release -o $PublishPath

            Write-Host ""
            Write-Host "✅ Publish completed. AppPool remains STOPPED." -ForegroundColor DarkYellow
            Pause
        }

        "2" {
            Write-Host ""
            Write-Host "▶️ Starting Application Pool..." -ForegroundColor Green
            Start-WebAppPool -Name $AppPoolName
            Pause
        }

        "3" {
            Write-Host ""
            Write-Host "⛔ Stopping Application Pool only..." -ForegroundColor Yellow
            Stop-WebAppPool -Name $AppPoolName
            Pause
        }

        "4" {
            Git-PushFlow
        }

        "5" {
            Write-Host "👋 Exiting..." -ForegroundColor Gray
            break
        }

        default {
            Write-Host "❌ Invalid option" -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
}
