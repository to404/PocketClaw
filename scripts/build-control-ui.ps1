# Build OpenClaw gateway Control UI (port 18789) into portable/dist/control-ui/.
# Requires: Git, Node.js, pnpm (npm install -g pnpm or corepack enable).
# git/pnpm use stderr for progress; must not use Stop or clone/build looks like a failure.
$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$PkgJson = Join-Path $Root "portable\app\core\node_modules\openclaw\package.json"
$Dest = Join-Path $Root "portable\dist\control-ui"

function Write-Info($msg) { Write-Host "[build-control-ui] $msg" }

if (-not (Test-Path $PkgJson)) {
    Write-Host "[build-control-ui] ERROR: OpenClaw not installed: $PkgJson" -ForegroundColor Red
    Write-Host "Run portable\system\setup.bat openclaw first." -ForegroundColor Yellow
    exit 1
}

$ver = (Get-Content -Raw $PkgJson | ConvertFrom-Json).version
Write-Info "OpenClaw package version: $ver"

$tmp = Join-Path $env:TEMP ("openclaw-src-" + [Guid]::NewGuid().ToString("n").Substring(0, 8))
$src = Join-Path $tmp "src"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

try {
    $branch = "v$ver"
    git clone --depth 1 --branch $branch "https://github.com/openclaw/openclaw.git" $src
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Branch $branch not found, cloning default branch..."
        git clone --depth 1 "https://github.com/openclaw/openclaw.git" $src
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[build-control-ui] ERROR: git clone failed" -ForegroundColor Red
            exit 1
        }
    }

    Push-Location $src
    try {
        pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) {
            pnpm install
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[build-control-ui] ERROR: pnpm install failed" -ForegroundColor Red
                exit 1
            }
        }
        if (Test-Path "scripts\ui.js") {
            node scripts/ui.js build
        }
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path "dist\control-ui\index.html")) {
            pnpm ui:build
        }
    } finally {
        Pop-Location
    }

    $built = Join-Path $src "dist\control-ui\index.html"
    if (-not (Test-Path $built)) {
        Write-Host "[build-control-ui] ERROR: Build did not produce dist/control-ui/index.html" -ForegroundColor Red
        exit 1
    }

    if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
    New-Item -ItemType Directory -Path $Dest -Force | Out-Null
    Copy-Item -Path (Join-Path $src "dist\control-ui\*") -Destination $Dest -Recurse -Force
    Write-Info "Copied Control UI to $Dest"
}
finally {
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
}
