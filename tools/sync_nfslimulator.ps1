param(
  [Parameter(Mandatory=$true)][string]$RepoRoot,
  [string]$UseLocal
)

$ErrorActionPreference = "Stop"

if (-not $UseLocal -and -not $env:NFL_REPO_URL) {
  Write-Error "Set NFL_REPO_URL env var or pass -UseLocal <path>"
}

$NflDst = Join-Path $RepoRoot "WebSites/NFLSimulator"
New-Item -ItemType Directory -Path (Join-Path $RepoRoot "WebSites") -Force | Out-Null
if (Test-Path $NflDst) { Remove-Item $NflDst -Recurse -Force }
New-Item -ItemType Directory -Path $NflDst | Out-Null

if ($UseLocal) {
  Write-Host "[sync] Copying from local: $UseLocal → $NflDst"
  robocopy $UseLocal $NflDst /E /NFL /NDL /NJH /NJS | Out-Null
} else {
  $tmp = New-Item -ItemType Directory -Path ([System.IO.Path]::GetTempPath() + [System.Guid]::NewGuid()) -Force
  Write-Host "[sync] Cloning $env:NFL_REPO_URL into $($tmp.FullName)"
  git clone --depth=1 $env:NFL_REPO_URL (Join-Path $tmp.FullName "NFLSimulator") | Out-Null
  robocopy (Join-Path $tmp.FullName "NFLSimulator") $NflDst /E /NFL /NDL /NJH /NJS | Out-Null
  Remove-Item $tmp.FullName -Recurse -Force
}

$index = Join-Path $NflDst "index.html"
if (-not (Test-Path $index)) {
  foreach ($cand in @("dist\index.html","build\index.html","public\index.html")) {
    $full = Join-Path $NflDst $cand
    if (Test-Path $full) {
      Write-Host "[sync] Found $cand; promoting to root index.html"
      $srcDir = Split-Path $full -Parent
      robocopy $srcDir $NflDst /E /NFL /NDL /NJH /NJS | Out-Null
      break
    }
  }
}

if (Test-Path $index) {
  Write-Host "[sync] Injecting navbar/footer and assets path"
  python3 (Join-Path $RepoRoot "tools/inject_nav_footer.py") --repo-root $RepoRoot --nfl-path "WebSites/NFLSimulator/index.html" | Out-Null
} else {
  Write-Warning "No index.html found in NFLSimulator content."
}

Write-Host "[sync] Done. Next steps:"
Write-Host "  git -C `"$RepoRoot`" add WebSites/NFLSimulator"
Write-Host "  git -C `"$RepoRoot`" commit -m `"Sync NFLSimulator`""
