import { execFile, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, shell } from 'electron'

const desktopDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.resolve(desktopDirectory, '..')
let backendProcess = null
let backendUrl = null
let quitting = false

function sqliteUrl(databasePath) {
  return `sqlite:///${databasePath.replaceAll('\\', '/')}`
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
  })
}

function backendCommand(port) {
  if (app.isPackaged) {
    return {
      command: path.join(process.resourcesPath, 'backend', 'playlist-studio-backend.exe'),
      args: ['--port', String(port)],
      cwd: path.join(process.resourcesPath, 'backend'),
      frontend: path.join(process.resourcesPath, 'frontend'),
    }
  }
  const python = process.env.YTDL_PYTHON
    || path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
  return {
    command: python,
    args: ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port)],
    cwd: path.join(projectRoot, 'backend'),
    frontend: path.join(projectRoot, 'frontend', 'dist'),
  }
}

function startBackend(port) {
  const runtime = backendCommand(port)
  const dataDirectory = path.join(app.getPath('userData'), 'data')
  const downloadsDirectory = path.join(app.getPath('downloads'), 'Playlist Studio')
  const runtimeBin = app.isPackaged ? path.join(process.resourcesPath, 'runtime') : null
  const pathValue = runtimeBin
    ? `${runtimeBin}${path.delimiter}${process.env.PATH ?? ''}`
    : process.env.PATH
  backendProcess = spawn(runtime.command, runtime.args, {
    cwd: runtime.cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PATH: pathValue,
      ELECTRON_RUN_AS_NODE: '1',
      YTDL_DATABASE_URL: sqliteUrl(path.join(dataDirectory, 'app.db')),
      YTDL_DOWNLOAD_ROOT: downloadsDirectory,
      YTDL_FRONTEND_DIST: runtime.frontend,
      YTDL_NODE_PATH: process.execPath,
    },
  })
  backendProcess.stdout.on('data', (chunk) => console.log(`[backend] ${chunk}`.trimEnd()))
  backendProcess.stderr.on('data', (chunk) => console.error(`[backend] ${chunk}`.trimEnd()))
  backendProcess.once('exit', (code, signal) => {
    if (!quitting) console.error(`Backend kapandı (kod=${code}, sinyal=${signal}).`)
    backendProcess = null
  })
}

async function waitForBackend(url) {
  let lastError = null
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch (error) { lastError = error }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Yerel indirme servisi başlatılamadı. ${lastError?.message ?? ''}`.trim())
}

function stopBackend() {
  if (!backendProcess?.pid) return
  const pid = backendProcess.pid
  backendProcess = null
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {})
  } else {
    try { process.kill(pid, 'SIGTERM') } catch { /* Process already exited. */ }
  }
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    show: false,
    backgroundColor: '#f4f5f0',
    autoHideMenuBar: true,
    title: 'Playlist Studio',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!backendUrl || !url.startsWith(backendUrl)) event.preventDefault()
  })
  window.once('ready-to-show', () => window.show())
  await window.loadURL(backendUrl)
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window) { if (window.isMinimized()) window.restore(); window.focus() }
  })
  app.whenReady().then(async () => {
    try {
      const port = await availablePort()
      backendUrl = `http://127.0.0.1:${port}`
      startBackend(port)
      await waitForBackend(backendUrl)
      await createWindow()
    } catch (error) {
      dialog.showErrorBox('Playlist Studio başlatılamadı', error instanceof Error ? error.message : String(error))
      app.quit()
    }
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && backendUrl) void createWindow()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => { quitting = true; stopBackend() })
}
