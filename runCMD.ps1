Import-Module WebAdministration

# ============================
# CONFIG
# ============================
$AppPoolName = "PocusSchedualer"
$PublishPath = "E:\inetpub\wwwroot\simcenter\PocusSchedualer\api"
$RepoPath    = "E:\dev\simPocusSchedualerBackend\PocusSchedualer"

# Frontend paths
$DevWwwrootPath  = Join-Path $RepoPath "wwwroot"
$IisFrontendPath = "E:\inetpub\wwwroot\simcenter\PocusSchedualer"

# Which asset folders to sync (if exist)
$FrontendFolders = @("css","js","images","img","fonts")

# ============================
# HELPERS
# ============================

function Ensure-GitAvailable {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Git not found in PATH" -ForegroundColor Red
        return $false
    }
    return $true
}

function Invoke-Git {
    param(
        [Parameter(Mandatory=$true)][string[]]$Args,
        [switch]$ThrowOnError = $true
    )

    $out = & git @Args 2>&1
    $code = $LASTEXITCODE

    if ($out) { $out | ForEach-Object { Write-Host $_ } }

    if ($ThrowOnError -and $code -ne 0) {
        throw "git $($Args -join ' ') failed (exit code $code)."
    }

    return @{ ExitCode = $code; Output = $out }
}

function Get-CurrentGitBranch {
    $r = Invoke-Git -Args @("branch","--show-current") -ThrowOnError:$false
    $b = ($r.Output | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($b)) { return $null }
    return $b
}

function Git-PushSmart {
    Write-Host "🚀 git push" -ForegroundColor Green
    $r = Invoke-Git -Args @("push") -ThrowOnError:$false
    if ($r.ExitCode -eq 0) {
        Write-Host "✅ Git push completed" -ForegroundColor Green
        return
    }

    $branch = Get-CurrentGitBranch
    if (-not $branch) { throw "Cannot detect current branch." }

    Write-Host "⚠️ Push failed. Trying: git push -u origin $branch" -ForegroundColor Yellow
    Invoke-Git -Args @("push","-u","origin",$branch) -ThrowOnError
    Write-Host "✅ Git push completed (upstream set)" -ForegroundColor Green
}

function Copy-MirrorFolder {
    param(
        [Parameter(Mandatory=$true)][string]$Source,
        [Parameter(Mandatory=$true)][string]$Destination
    )

    if (-not (Test-Path $Source)) { return $false }

    if (-not (Test-Path $Destination)) {
        New-Item -ItemType Directory -Path $Destination | Out-Null
    }

    # /MIR mirrors folder (adds + deletes) within that folder
    # Robocopy codes < 8 are success-ish
    $args = @(
        "`"$Source`"",
        "`"$Destination`"",
        "/MIR",
        "/FFT",
        "/R:1",
        "/W:1",
        "/NP",
        "/NFL",
        "/NDL"
    )

    Start-Process -FilePath "robocopy.exe" -ArgumentList $args -Wait -NoNewWindow | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "Robocopy failed (exit code $LASTEXITCODE) for: $Source -> $Destination"
    }
    return $true
}

# ============================
# FLOWS
# ============================

function Git-PushFlow {

    if (-not (Ensure-GitAvailable)) { Pause; return }
    if (-not (Test-Path $RepoPath)) {
        Write-Host "❌ Repo path not found: $RepoPath" -ForegroundColor Red
        Pause; return
    }

    Push-Location $RepoPath
    try {
        if (-not (Test-Path ".git")) {
            Write-Host "❌ This folder is not a Git repository (.git missing)" -ForegroundColor Red
            Pause; return
        }

        Write-Host ""
        Write-Host "📁 Repo: $RepoPath" -ForegroundColor Cyan
        Write-Host ""

        Invoke-Git -Args @("status") -ThrowOnError:$false | Out-Null

        $changes = & git status --porcelain
        if (-not $changes) {
            Write-Host "ℹ️ No changes to commit." -ForegroundColor DarkYellow
            $push = Read-Host "Push anyway? (y/n)"
            if ($push -match '^(y|yes)$') { Git-PushSmart }
            Pause
            return
        }

        $msg = Read-Host "Commit message"
        if ([string]::IsNullOrWhiteSpace($msg)) {
            $msg = "Auto deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        }

        Write-Host "➕ git add -A" -ForegroundColor Yellow
        Invoke-Git -Args @("add","-A") | Out-Null

        Write-Host "📝 git commit" -ForegroundColor Yellow
        $commitRes = Invoke-Git -Args @("commit","-m",$msg) -ThrowOnError:$false
        if ($commitRes.ExitCode -ne 0) {
            Write-Host "❌ Commit failed (see output above)" -ForegroundColor Red
            Pause
            return
        }

        Git-PushSmart
        Pause
    }
    catch {
        Write-Host ""
        Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        Pause
    }
    finally {
        Pop-Location
    }
}

function Deploy-FrontendFromDevToIis {

    if (-not (Test-Path $DevWwwrootPath)) {
        Write-Host "❌ DEV wwwroot not found: $DevWwwrootPath" -ForegroundColor Red
        Pause
        return
    }
    if (-not (Test-Path $IisFrontendPath)) {
        Write-Host "❌ IIS Frontend path not found: $IisFrontendPath" -ForegroundColor Red
        Pause
        return
    }

    Write-Host ""
    Write-Host "==============================================" -ForegroundColor DarkCyan
    Write-Host " Deploy Frontend: DEV wwwroot -> IIS Frontend " -ForegroundColor White
    Write-Host "==============================================" -ForegroundColor DarkCyan
    Write-Host "DEV: $DevWwwrootPath" -ForegroundColor Cyan
    Write-Host "IIS: $IisFrontendPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "NOTE: This updates HTML/JS/CSS and does NOT touch 'api\'." -ForegroundColor DarkYellow
    Write-Host ""

    $confirm = Read-Host "Continue deploy frontend? (y/n)"
    if ($confirm -notmatch '^(y|yes)$') {
        Write-Host "Skipped." -ForegroundColor DarkYellow
        Pause
        return
    }

    # 1) Sync asset folders
    foreach ($f in $FrontendFolders) {
        $src = Join-Path $DevWwwrootPath $f
        $dst = Join-Path $IisFrontendPath $f

        if (Test-Path $src) {
            Write-Host "📁 Sync folder: $f" -ForegroundColor Yellow
            Copy-MirrorFolder -Source $src -Destination $dst | Out-Null
            Write-Host "✅ Done: $f" -ForegroundColor Green
        }
    }

    # 2) Copy root HTML files
    Write-Host "📄 Copy root *.html" -ForegroundColor Yellow
    Get-ChildItem -Path $DevWwwrootPath -Filter "*.html" -File -ErrorAction SilentlyContinue |
        ForEach-Object {
            Copy-Item $_.FullName (Join-Path $IisFrontendPath $_.Name) -Force
        }

    # 3) Optional: copy root favicon/manifest/etc (common static files)
    $rootExtras = @("favicon.ico","site.webmanifest","manifest.json","robots.txt")
    foreach ($x in $rootExtras) {
        $srcX = Join-Path $DevWwwrootPath $x
        if (Test-Path $srcX) {
            Copy-Item $srcX (Join-Path $IisFrontendPath $x) -Force
        }
    }

    Write-Host ""
    Write-Host "✅ Frontend deployed to IIS." -ForegroundColor Green
    Pause
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
    Write-Host "5 - Deploy Frontend (DEV wwwroot -> IIS HTML)"
    Write-Host "6 - Exit"
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
            Deploy-FrontendFromDevToIis
        }

        "6" {
            Write-Host "👋 Exiting..." -ForegroundColor Gray
            break
        }

        default {
            Write-Host "❌ Invalid option" -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
}
