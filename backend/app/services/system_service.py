"""Check the same Python packages and Node runtime used by the downloader."""

import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version

from app.schemas.system import DependencyCheck, SystemCheck


def _package(name: str) -> DependencyCheck:
    try:
        installed = version(name)
    except PackageNotFoundError:
        return DependencyCheck(
            name=name, ready=False,
            message="Python bağımlılığı eksik. Sanal ortamda backend/requirements.txt paketlerini kurun.",
        )
    return DependencyCheck(name=name, ready=True, version=installed, message="Hazır.")


def _executable(name: str) -> DependencyCheck:
    executable = shutil.which(name)
    if executable is None:
        return DependencyCheck(
            name=name, ready=False,
            message=f"{name} bulunamadı. Programı kurup PATH'e ekleyin ve backend'i yeni terminalde başlatın.",
        )
    try:
        result = subprocess.run(
            [executable, "--version" if name == "node" else "-version"],
            shell=False, capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=3, check=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    except subprocess.TimeoutExpired:
        return DependencyCheck(name=name, ready=False, message=f"{name} sürüm kontrolü zaman aşımına uğradı.")
    except OSError:
        return DependencyCheck(name=name, ready=False, message=f"{name} çalıştırılamadı. Kurulumu ve çalıştırma izinlerini kontrol edin.")
    if result.returncode:
        return DependencyCheck(name=name, ready=False, message=f"{name} sürüm komutu hata verdi. Kurulumu kontrol edin.")
    pattern = r"^v(\d+\.\d+\.\d+)" if name == "node" else rf"^{name} version (\S+)"
    match = re.search(pattern, result.stdout.strip())
    if match is None:
        return DependencyCheck(name=name, ready=False, message=f"{name} sürümü doğrulanamadı.")
    installed = match.group(1)
    if name == "node" and int(installed.split(".")[0]) < 22:
        return DependencyCheck(
            name=name, ready=False, version=installed,
            message="İndirme motoru için Node.js 22 veya üzerini kurun.",
        )
    return DependencyCheck(name=name, ready=True, version=installed, message="Hazır.")


def check_system() -> SystemCheck:
    components = [_package("yt-dlp"), _package("yt-dlp-ejs")]
    components.extend(_executable(name) for name in ("ffmpeg", "ffprobe", "node"))
    return SystemCheck(
        ready=all(component.ready for component in components),
        checked_at=datetime.now(timezone.utc), components=components,
    )
