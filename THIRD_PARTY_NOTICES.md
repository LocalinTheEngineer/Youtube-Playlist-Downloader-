# Third-party notices

Playlist Studio combines independent open-source components. Each component remains
subject to its own license.

## FFmpeg and ffprobe

The Windows package includes separate FFmpeg and ffprobe executables from the Gyan
Windows builds. That build is distributed under GNU GPL version 3 because it enables
GPL components. A copy of GPLv3 is included in the installed application's `licenses`
directory.

- Project: https://ffmpeg.org/
- Exact upstream source tag: https://github.com/FFmpeg/FFmpeg/tree/n8.0.1
- Windows build source and information: https://www.gyan.dev/ffmpeg/builds/
- License information: https://ffmpeg.org/legal.html

## Other dependencies

Electron, React, FastAPI, yt-dlp, yt-dlp-ejs and their transitive dependencies are
included or used according to the license metadata distributed with their packages.
Electron's generated `LICENSES.chromium.html` and dependency licenses are preserved
in the packaged application where provided by the packaging tool.
