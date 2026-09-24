from pathlib import Path

from PyInstaller.utils.hooks import collect_all, copy_metadata


backend_dir = Path(SPECPATH)
datas, binaries, hiddenimports = collect_all("yt_dlp")
ejs_datas, ejs_binaries, ejs_hiddenimports = collect_all("yt_dlp_ejs")
datas += ejs_datas + copy_metadata("yt-dlp-ejs")
binaries += ejs_binaries
hiddenimports += ejs_hiddenimports

analysis = Analysis(
    [str(backend_dir / "desktop_entry.py")],
    pathex=[str(backend_dir)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(analysis.pure)

executable = EXE(
    pyz,
    analysis.scripts,
    analysis.binaries,
    analysis.datas,
    [],
    name="playlist-studio-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
