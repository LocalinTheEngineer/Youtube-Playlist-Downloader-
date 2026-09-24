$ErrorActionPreference = "Stop"

$desktopDirectory = Split-Path -Parent $PSScriptRoot
$projectDirectory = Split-Path -Parent $desktopDirectory
$pythonPath = Join-Path $projectDirectory ".venv\Scripts\python.exe"
$specPath = Join-Path $projectDirectory "backend\playlist-studio-backend.spec"
$workPath = Join-Path $projectDirectory "backend\build"
$distPath = Join-Path $projectDirectory "backend\dist"
$stagePath = Join-Path $desktopDirectory "runtime\backend"

if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
    throw "Python sanal ortamı bulunamadı: $pythonPath"
}

& $pythonPath -m PyInstaller --noconfirm --clean --workpath $workPath --distpath $distPath $specPath
if ($LASTEXITCODE -ne 0) { throw "Backend paketi oluşturulamadı." }

New-Item -ItemType Directory -Force -Path $stagePath | Out-Null
Copy-Item -LiteralPath (Join-Path $distPath "playlist-studio-backend.exe") -Destination $stagePath -Force
