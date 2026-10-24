# ============================================================
#  DEPLOYIIS.ps1
#  Full non-interactive deploy: backend + frontend
#  Run from dev machine -- uses UNC paths to \\localrecord
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
$ApiPublishPath  = "\\$ServerName\e$\dev\simSchedualer\api"
$IisFrontend     = "\\$ServerName\e$\dev\simSchedualer"
$WwwrootSrc      = Join-Path $RepoPath "wwwroot"
$FrontendFolders = @("css", "js", "config", "img")

# ============================================================
# HELPERS
# ============================================================
function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host "-- $msg" -ForegroundColor DarkCyan
}

function Robosync([string]$src, [string]$dst) {
    if (-not (Test-Path $src)) {
        Write-Host "  [skip] Source missing: $src" -ForegroundColor DarkYellow
        return
    }
    $result = robocopy $src $dst "*.*" /E /XO /FFT /R:1 /W:1 /NP /NJH /NJS /NDL
    $copied = $result | Where-Object { $_ -match '^\s{2,}\S' -and $_ -notmatch '^$' }
    if ($copied) {
        $copied | ForEach-Object { Write-Host "  + $($_.Trim())" -ForegroundColor Green }
    } else {
        Write-Host "  [ok] Up-to-date" -ForegroundColor DarkYellow
    }
    if ($LASTEXITCODE -ge 8) { throw "Robocopy failed with exit code $LASTEXITCODE" }
}

# ============================================================
# HEADER
# ============================================================
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  DEPLOYIIS -- PocusSchedualer" -ForegroundColor White
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor DarkGray
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Server   : $ServerName" -ForegroundColor Gray
Write-Host "  AppPool  : $AppPoolName" -ForegroundColor Gray
Write-Host "  Backend  : $ApiPublishPath" -ForegroundColor Gray
Write-Host "  Frontend : $IisFrontend" -ForegroundColor Gray

# ============================================================
# BACKEND: build -> app_offline trick -> robocopy -> restore
# ============================================================
if (-not $FrontendOnly) {
    Write-Step "dotnet publish -> $RepoPath\publish_out"
    Set-Location $PSScriptRoot

    # Clean stale build cache
    Remove-Item -Recurse -Force "C:\Temp\pocus-build" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force (Join-Path $PSScriptRoot "obj") -ErrorAction SilentlyContinue

    dotnet publish -c Release -o (Join-Path $PSScriptRoot "publish_out") /p:BaseIntermediateOutputPath=C:\Temp\pocus-build\
    if ($LASTEXITCODE -ne 0) { Write-Host "[FAIL] dotnet publish failed" -ForegroundColor Red; exit 1 }
    Write-Host "  [ok] Build OK" -ForegroundColor Green

    Write-Step "Deploying backend via app_offline.htm"
    $offline = Join-Path $ApiPublishPath "app_offline.htm"
    '<html><body>Deploying, please wait...</body></html>' | Out-File $offline -Encoding utf8
    Write-Host "  app_offline.htm created -- waiting 4s..." -ForegroundColor Yellow
    Start-Sleep -Seconds 4

    $src = Join-Path $PSScriptRoot "publish_out"
    robocopy $src $ApiPublishPath /E /IS /IT /XF "app_offline.htm" /XD "publish_out" "publish" "publish_deploy" "publish_tmp" /R:2 /W:2 /NP /NJH /NJS
    $rc = $LASTEXITCODE

    Remove-Item $offline -Force -ErrorAction SilentlyContinue
    Write-Host "  app_offline.htm removed -- app online" -ForegroundColor Green

    if ($rc -ge 8) { Write-Host "[FAIL] Robocopy error: $rc" -ForegroundColor Red; exit 1 }
    Write-Host "  [ok] Backend deployed" -ForegroundColor Green
}

# ============================================================
# FRONTEND: folders + HTML files
# ============================================================
if (-not $BackendOnly) {
    Write-Step "Deploying frontend"

    foreach ($folder in $FrontendFolders) {
        Write-Host "  -- $folder" -ForegroundColor DarkCyan
        Robosync (Join-Path $WwwrootSrc $folder) (Join-Path $IisFrontend $folder)
    }

    Write-Host "  -- *.html" -ForegroundColor DarkCyan
    Get-ChildItem $WwwrootSrc -Filter "*.html" -File | ForEach-Object {
        $dst = Join-Path $IisFrontend $_.Name
        $copy = (-not (Test-Path $dst)) -or ($_.LastWriteTimeUtc -gt (Get-Item $dst).LastWriteTimeUtc)
        if ($copy) {
            Copy-Item $_.FullName $dst -Force
            Write-Host "  + $($_.Name)" -ForegroundColor Green
        }
    }

    Write-Host "  [ok] Frontend deployed" -ForegroundColor Green
}

# ============================================================
# DONE
# ============================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  DEPLOYIIS COMPLETE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
