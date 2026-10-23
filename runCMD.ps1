Import-Module WebAdministration

# =====================================================
# CONFIG
# =====================================================

$AppPoolName = "PocusSchedualer"

# Backend
$PublishPath = "E:\inetpub\wwwroot\simcenter\PocusSchedualer\api"
$RepoPath    = "E:\dev\simPocusSchedualerBackend\PocusSchedualer"

# Frontend
$DevWwwrootPath  = Join-Path $RepoPath "wwwroot"
$IisFrontendPath = "E:\inetpub\wwwroot\simcenter\PocusSchedualer"

# Frontend folders to deploy
$FrontendFolders = @("css","js","config","img")

# =====================================================
# HELPERS
# =====================================================

function Ensure-GitAvailable {
    return [bool](Get-Command git -ErrorAction SilentlyContinue)
}

function Invoke-Git {
    param([string[]]$Args)
    & git @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Args -join ' ')"
    }
}

# -----------------------------------------------------
# SAFE APPPOOL STOP (NO ERROR IF ALREADY DOWN)
# -----------------------------------------------------

function Stop-AppPoolSafe {
    param([Parameter(Mandatory=$true)][string]$Name)

    try {
        $state = (Get-WebAppPoolState -Name $Name -ErrorAction Stop).Value
        if ($state -eq "Stopped") {
            Write-Host "ℹ️ POOL ALREADY DOWN: $Name" -ForegroundColor DarkYellow
            return
        }

        Stop-WebAppPool -Name $Name -ErrorAction Stop
        Write-Host "🛑 POOL STOPPED: $Name" -ForegroundColor Yellow
    }
    catch {
        Write-Host "ℹ️ POOL ALREADY DOWN: $Name" -ForegroundColor DarkYellow
    }
}

# =====================================================
# ROBOCOPY – COPY ONLY CHANGED FILES + SHOW WHAT COPIED
# =====================================================

function Copy-ChangedFilesOnly {
    param(
        [Parameter(Mandatory=$true)][string]$Source,
        [Parameter(Mandatory=$true)][string]$Destination
    )

    if (-not (Test-Path $Source)) {
        Write-Host "ℹ️ Source missing: $Source" -ForegroundColor DarkYellow
        return
    }

    if (-not (Test-Path $Destination)) {
        New-Item -ItemType Directory -Path $Destination | Out-Null
    }

    $log = Join-Path $env:TEMP ("robocopy_" + [guid]::NewGuid() + ".log")

    $args = @(
        $Source,
        $Destination,
        "*.*",
        "/E",
        "/XO",
        "/FFT",
        "/R:1",
        "/W:1",
        "/NP",
        "/NDL",
        "/NJH",
        "/NJS",
        "/LOG:$log"
    )

    & robocopy @args | Out-Null
    $rc = $LASTEXITCODE

    if ($rc -ge 8) {
        Write-Host "❌ Robocopy failed (exit code $rc)" -ForegroundColor Red
        if (Test-Path $log) {
            Get-Content $log | Select-Object -Last 80
        }
        throw "Robocopy failed"
    }

    $lines = @()
    if (Test-Path $log) { $lines = Get-Content $log }

    $copiedLines = $lines | Where-Object {
        $_ -match '^\s*(New File|Newer|Changed)\s+'
    }

    if (-not $copiedLines) {
        Write-Host "ℹ️ No files copied (up-to-date)" -ForegroundColor DarkYellow
    }
    else {
        Write-Host "📄 Files copied:" -ForegroundColor Cyan
        foreach ($line in $copiedLines) {
            $file = ($line -split "\s{2,}")[-1]
            Write-Host "➕ $file" -ForegroundColor Green
        }
    }

    Remove-Item $log -Force -ErrorAction SilentlyContinue
}

# =====================================================
# GIT SUB MENU
# =====================================================

function Show-GitSubMenu {

    if (-not (Ensure-GitAvailable)) {
        Write-Host "❌ Git not found" -ForegroundColor Red
        Pause
        return
    }

    Push-Location $RepoPath
    try {
        while ($true) {
            Clear-Host
            Write-Host "==================================" -ForegroundColor DarkCyan
            Write-Host " Git Sub Menu " -ForegroundColor White
            Write-Host "==================================" -ForegroundColor DarkCyan
            Write-Host ""
            Write-Host "1  - Status"
            Write-Host "2  - Diff"
            Write-Host "3  - Diff (staged)"
            Write-Host "4  - Add ALL"
            Write-Host "5  - Add modified/deleted"
            Write-Host "6  - Add interactive"
            Write-Host "7  - Commit"
            Write-Host "8  - Amend commit"
            Write-Host "9  - Push"
            Write-Host "10 - Pull --rebase"
            Write-Host "11 - Undo last commit"
            Write-Host "12 - Clean untracked (preview)"
            Write-Host "13 - Clean untracked (DELETE)"
            Write-Host "0  - Back"
            Write-Host ""

            switch (Read-Host "Choose option") {
                "1"  { git status -sb; Pause }
                "2"  { git diff; Pause }
                "3"  { git diff --staged; Pause }
                "4"  { Invoke-Git @("add","-A"); Pause }
                "5"  { Invoke-Git @("add","-u"); Pause }
                "6"  { git add -p; Pause }
                "7"  {
                    $msg = Read-Host "Commit message"
                    if ($msg) { Invoke-Git @("commit","-m",$msg) }
                    Pause
                }
                "8"  { git commit --amend; Pause }
                "9"  { Invoke-Git @("push"); Pause }
                "10" { Invoke-Git @("pull","--rebase"); Pause }
                "11" {
                    if ((Read-Host "Undo last commit? (y/n)") -match 'y') {
                        git reset --soft HEAD~1
                    }
                    Pause
                }
                "12" { git clean -fd -n; Pause }
                "13" {
                    if ((Read-Host "DELETE all untracked files? (y/n)") -match 'y') {
                        git clean -fd
                    }
                    Pause
                }
                "0"  { return }
            }
        }
    }
    finally {
        Pop-Location
    }
}

# =====================================================
# DEPLOY FRONTEND  (NO Y/N)
# =====================================================

function Deploy-Frontend {

    Clear-Host
    Write-Host "==============================================" -ForegroundColor DarkCyan
    Write-Host " Frontend Deploy (DEV → IIS) " -ForegroundColor White
    Write-Host "==============================================" -ForegroundColor DarkCyan

    foreach ($f in $FrontendFolders) {
        Write-Host ""
        Write-Host "---- Sync folder: $f ----" -ForegroundColor DarkCyan
        $src = Join-Path $DevWwwrootPath $f
        $dst = Join-Path $IisFrontendPath $f
        Copy-ChangedFilesOnly -Source $src -Destination $dst
    }

    Write-Host ""
    Write-Host "---- Sync root HTML files ----" -ForegroundColor DarkCyan

    Get-ChildItem $DevWwwrootPath -Filter "*.html" -File | ForEach-Object {
        $dst = Join-Path $IisFrontendPath $_.Name
        if (-not (Test-Path $dst) -or $_.LastWriteTimeUtc -gt (Get-Item $dst).LastWriteTimeUtc) {
            Copy-Item $_.FullName $dst -Force
            Write-Host "➕ $($_.Name)" -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "✅ Frontend deployment completed" -ForegroundColor Green
    Pause
}

# =====================================================
# MAIN MENU
# =====================================================

while ($true) {

    Clear-Host
    Write-Host "==================================" -ForegroundColor DarkCyan
    Write-Host " PocusSchedualer Deployment Tool " -ForegroundColor White
    Write-Host "==================================" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "1 - Stop AppPool + Publish (.NET)"
    Write-Host "2 - Start AppPool"
    Write-Host "3 - Stop AppPool only"
    Write-Host "4 - Git Commit + Push"
    Write-Host "5 - Deploy Frontend"
    Write-Host "6 - Git Menu"
    Write-Host "7 - Exit"
    Write-Host ""

    switch (Read-Host "Choose option") {

        "1" {
            Stop-AppPoolSafe -Name $AppPoolName
            dotnet publish -c Release -o $PublishPath
            Pause
        }

        "2" { Start-WebAppPool -Name $AppPoolName; Pause }
        "3" { Stop-AppPoolSafe -Name $AppPoolName; Pause }
        "4" { Git-PushFlow }
        "5" { Deploy-Frontend }
        "6" { Show-GitSubMenu }
        "7" { break }
    }
}
