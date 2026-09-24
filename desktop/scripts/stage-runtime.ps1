$ErrorActionPreference = "Stop"

$desktopDirectory = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $desktopDirectory "runtime\bin"
$defaultFfmpegPath = Join-Path $env:LOCALAPPDATA "Programs\FFmpeg\bin"
$ffmpegPath = if ($env:YTDL_FFMPEG_BIN) { $env:YTDL_FFMPEG_BIN } else { $defaultFfmpegPath }

$ffmpegExe = Join-Path $ffmpegPath "ffmpeg.exe"
$ffprobeExe = Join-Path $ffmpegPath "ffprobe.exe"
if (-not (Test-Path -LiteralPath $ffmpegExe -PathType Leaf)) {
    throw "ffmpeg.exe bulunamadı. YTDL_FFMPEG_BIN ile klasörü belirtin."
}
if (-not (Test-Path -LiteralPath $ffprobeExe -PathType Leaf)) {
    throw "ffprobe.exe bulunamadı. YTDL_FFMPEG_BIN ile klasörü belirtin."
}

New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
Copy-Item -LiteralPath $ffmpegExe -Destination $runtimePath -Force
Copy-Item -LiteralPath $ffprobeExe -Destination $runtimePath -Force
