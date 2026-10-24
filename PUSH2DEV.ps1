# ============================================================
#  PUSH2DEV.ps1
#  git add -A → commit → push
#  Usage: .\PUSH2DEV.ps1 "commit message"
#         .\PUSH2DEV.ps1          (prompts for message)
# ============================================================
param(
    [string]$Message = ""
)

Set-Location $PSScriptRoot

# ---------- message ----------
if (-not $Message) {
    $Message = Read-Host "Commit message"
}
if (-not $Message.Trim()) {
    Write-Host "❌ No commit message — aborting" -ForegroundColor Red
    exit 1
}

# ---------- status ----------
Write-Host ""
Write-Host "── git status ─────────────────────────────" -ForegroundColor DarkCyan
git status -sb

# ---------- stage ----------
Write-Host ""
Write-Host "── staging all ─────────────────────────────" -ForegroundColor DarkCyan
git add -A
if ($LASTEXITCODE -ne 0) { Write-Host "❌ git add failed" -ForegroundColor Red; exit 1 }

# ---------- nothing to commit? ----------
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "ℹ️  Nothing to commit — working tree clean" -ForegroundColor DarkYellow
    exit 0
}

# ---------- commit ----------
Write-Host ""
Write-Host "── committing ──────────────────────────────" -ForegroundColor DarkCyan
git commit -m "$Message"
if ($LASTEXITCODE -ne 0) { Write-Host "❌ git commit failed" -ForegroundColor Red; exit 1 }

# ---------- push ----------
Write-Host ""
Write-Host "── pushing ─────────────────────────────────" -ForegroundColor DarkCyan
git push
if ($LASTEXITCODE -ne 0) { Write-Host "❌ git push failed" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "✅ PUSH2DEV done" -ForegroundColor Green
