# ============================================================
#  DEPLOYIIS.ps1
#  Full non-interactive deploy: backend + frontend
#  Run from dev machine — uses UNC paths to \\localrecord
#
#  AppPool management: requires WebAdministration on the server.
#  This script uses Invoke-Command to the server when possible.
#  If WinRM is not available, AppPool is recycled via a fallback
#  (or you can set $SkipAppPool = $true to skip it entirely).
#
#  Usage:
#    .\DEPLOYIIS.ps1                  # full deploy
#    .\DEPLOYIIS.ps1 -SkipAppPool     # deploy files only, no AppPool restart
#    .\DEPLOYIIS.ps1 -FrontendOnly    # frontend files only
#    .\DEPLOYIIS.ps1 -BackendOnly     # dotnet publish only
# ============================================================
param(
    [switch]$SkipAppPool,
    [switch]$FrontendOnly,
    [switch]$BackendOnly
)

$ErrorActionPreference = "Stop"

# ============================================================
# CONFIG
# ============================================================
$ServerName      = "localrecord"
$AppPoolName     = "PocusSchedualer"
$RepoPath        = "\\$ServerName\e$\dev\simPocusSchedualerBackend\PocusSchedualer"
$ApiPublishPath  = "\\$ServerName\e$\inetpub\wwwroot\simcenter\PocusSchedualer\api"
$IisFrontend     = "\\$ServerName\e$\inetpub\wwwroot\simcenter\PocusSchedualer"
$WwwrootSrc      = Join-Path $RepoPath "wwwroot"
$FrontendFolders = @("css", "js", "config", "img")

# ============================================================
# HELPERS
# ============================================================
function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host "── $msg" -ForegroundColor DarkCyan
}

function Robosync([string]$src, [string]$dst) {
    if (-not (Test-Path $src)) {
        Write-Host "  ℹ️  Source missing, skipping: $src" -ForegroundColor DarkYellow
        return
    }
    $result = robocopy $src $dst "*.*" /E /XO /FFT /R:1 /W:1 /NP /NJH /NJS /NDL
    $copied = $result | Where-Object { $_ -match '^\s{2,}\S' -and $_ -notmatch '^$' }
    if ($copied) {
        $copied | ForEach-Object { Write-Host "  ➕ $($_.Trim())" -ForegroundColor Green }
    } else {
        Write-Host "  ℹ️  Up-to-date" -ForegroundColor DarkYellow
    }
    if ($LASTEXITCODE -ge 8) { throw "Robocopy failed with exit code $LASTEXITCODE" }
}

function Manage-AppPool([string]$action) {
    Write-Step "$action AppPool: $AppPoolName"

    # Try Invoke-Command to server (requires WinRM)
    try {
        Invoke-Command -ComputerName $ServerName -ErrorAction Stop -ScriptBlock {
            param($pool, $act)
            Import-Module WebAdministration
            if ($act -eq "Stop") {
                $state = (Get-WebAppPoolState -Name $pool).Value
                if ($state -ne "Stopped") {
                    Stop-WebAppPool -Name $pool
                    Start-Sleep -Milliseconds 800
                    Write-Host "  🛑 Stopped" -ForegroundColor Yellow
                } else {
                    Write-Host "  ℹ️  Already stopped" -ForegroundColor DarkYellow
                }
            } else {
                Start-WebAppPool -Name $pool
                Write-Host "  ✅ Started" -ForegroundColor Green
            }
        } -ArgumentList $AppPoolName, $action
        return $true
    }
    catch {
        Write-Host "  ⚠️  WinRM not available ($($_.Exception.Message))" -ForegroundColor Yellow
        Write-Host "  ➡️  AppPool NOT $($action.ToLower())ped — recycle manually via IIS or runCMD.ps1" -ForegroundColor Yellow
        return $false
    }
}

# ============================================================
# HEADER
# ============================================================
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  DEPLOYIIS — PocusSchedualer" -ForegroundColor White
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor DarkGray
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Server   : $ServerName" -ForegroundColor Gray
Write-Host "  AppPool  : $AppPoolName" -ForegroundColor Gray
Write-Host "  Backend  : $ApiPublishPath" -ForegroundColor Gray
Write-Host "  Frontend : $IisFrontend" -ForegroundColor Gray

# ============================================================
# BACKEND: build → app_offline trick → robocopy → restore
# ============================================================
if (-not $FrontendOnly) {
    Write-Step "dotnet publish → $RepoPath\publish_out"
    Set-Location $PSScriptRoot

    # Clean stale build cache
    Remove-Item -Recurse -Force "C:\Temp\pocus-build" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force (Join-Path $PSScriptRoot "obj") -ErrorAction SilentlyContinue

    dotnet publish -c Release -o (Join-Path $PSScriptRoot "publish_out") /p:BaseIntermediateOutputPath=C:\Temp\pocus-build\
    if ($LASTEXITCODE -ne 0) { Write-Host "❌ dotnet publish failed" -ForegroundColor Red; exit 1 }
    Write-Host "  ✅ Build OK" -ForegroundColor Green

    Write-Step "Deploying backend via app_offline.htm"
    $offline = Join-Path $ApiPublishPath "app_offline.htm"
    '<html><body>בפריסה... נא להמתין</body></html>' | Out-File $offline -Encoding utf8
    Write-Host "  app_offline.htm created — waiting 4s..." -ForegroundColor Yellow
    Start-Sleep -Seconds 4

    $src = Join-Path $PSScriptRoot "publish_out"
    robocopy $src $ApiPublishPath /E /IS /IT /XF "app_offline.htm" /XD "publish_out" "publish" "publish_deploy" "publish_tmp" /R:2 /W:2 /NP /NJH /NJS
    $rc = $LASTEXITCODE

    Remove-Item $offline -Force -ErrorAction SilentlyContinue
    Write-Host "  app_offline.htm removed — app online" -ForegroundColor Green

    if ($rc -ge 8) { Write-Host "❌ Robocopy error: $rc" -ForegroundColor Red; exit 1 }
    Write-Host "  ✅ Backend deployed" -ForegroundColor Green
}

# ============================================================
# FRONTEND: folders + HTML files
# ============================================================
if (-not $BackendOnly) {
    Write-Step "Deploying frontend"

    foreach ($folder in $FrontendFolders) {
        Write-Host "  ── $folder" -ForegroundColor DarkCyan
        Robosync (Join-Path $WwwrootSrc $folder) (Join-Path $IisFrontend $folder)
    }

    Write-Host "  ── *.html" -ForegroundColor DarkCyan
    Get-ChildItem $WwwrootSrc -Filter "*.html" -File | ForEach-Object {
        $dst = Join-Path $IisFrontend $_.Name
        $copy = (-not (Test-Path $dst)) -or ($_.LastWriteTimeUtc -gt (Get-Item $dst).LastWriteTimeUtc)
        if ($copy) {
            Copy-Item $_.FullName $dst -Force
            Write-Host "  ➕ $($_.Name)" -ForegroundColor Green
        }
    }

    Write-Host "  ✅ Frontend deployed" -ForegroundColor Green
}

# ============================================================
# DONE
# ============================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  ✅ DEPLOYIIS COMPLETE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
