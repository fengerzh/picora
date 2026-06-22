import { app, BrowserWindow, protocol, net } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { ConfigManager } from './config'
import { PhotoIndexer } from './indexer'
import { registerIpcHandlers, setMainWindow } from './ipc'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Set app name early so macOS Dock, menu bar, and window title all show "Picora"
// instead of the default "Electron" in dev mode
app.setName('Picora')

// Set app icon for dev mode (electron-builder handles this for packaged builds)
const iconPath = path.join(__dirname, '../../resources/icon.png')

// On macOS, set the Dock icon explicitly for dev mode
if (process.platform === 'darwin' && isDev && app.dock) {
  try {
    app.dock.setIcon(iconPath)
  } catch (e) {
    // ignore if icon not found
  }
}

// Register custom protocol scheme as privileged (must be before app.ready)
protocol.registerSchemesAsPrivileged([
  { scheme: 'picora-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null
let configManager: ConfigManager
let indexer: PhotoIndexer

// ─── Window state persistence ──────────────────────────────────────────────────

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

function windowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json')
}

async function loadWindowState(): Promise<WindowState> {
  try {
    const data = await fs.readFile(windowStatePath(), 'utf-8')
    return JSON.parse(data) as WindowState
  } catch {
    return { width: 1200, height: 800, isMaximized: false }
  }
}

async function saveWindowState(win: BrowserWindow): Promise<void> {
  const maximized = win.isMaximized()
  const bounds = maximized ? win.getNormalBounds() : win.getBounds()
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: maximized
  }
  try {
    await fs.writeFile(windowStatePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // Ignore write errors
  }
}

// ─── End window state ──────────────────────────────────────────────────────────

async function ensureThumbDir(): Promise<void> {
  const thumbDir = path.join(app.getPath('userData'), 'thumbnails')
  await fs.mkdir(thumbDir, { recursive: true })
}

let cachedWindowState: WindowState | null = null

function createWindow(): BrowserWindow {
  const state = cachedWindowState || { width: 1200, height: 800, isMaximized: false }

  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 600,
    title: 'Picora',
    icon: iconPath,
    show: false, // Don't show until ready to avoid flash
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Restore maximized state after window is created
  if (state.isMaximized) {
    win.maximize()
  }

  // Show window once ready
  win.once('ready-to-show', () => {
    win.show()
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Save state on move, resize, maximize, unmaximize
  const save = () => saveWindowState(win)
  win.on('resize', save)
  win.on('move', save)
  win.on('maximize', save)
  win.on('unmaximize', save)

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData')

  // Register picora-asset:// protocol to serve local files
  // URL format: picora-asset://localhost/C:/path/to/file.jpg (Windows)
  //             picora-asset://localhost/path/to/file.jpg (macOS/Linux)
  protocol.handle('picora-asset', (request) => {
    const url = new URL(request.url)
    let filePath = decodeURIComponent(url.pathname)

    // On Windows, pathname for C:\... becomes /C:/...
    // Also handle backslashes that may appear in encoded paths
    filePath = filePath.replace(/\\/g, '/')

    if (process.platform === 'win32') {
      // Remove leading slash before drive letter: /C:/... → C:/...
      if (/^\/[A-Za-z]:/.test(filePath)) {
        filePath = filePath.slice(1)
      }
      return net.fetch('file:///' + filePath)
    }

    return net.fetch('file://' + filePath)
  })

  // Initialize managers
  configManager = new ConfigManager(userDataPath)
  indexer = new PhotoIndexer(userDataPath)

  // Load the existing index from disk (if any)
  await indexer.load()

  // Ensure thumbnails directory exists
  await ensureThumbDir()

  // Load saved window state (position, size, maximized)
  cachedWindowState = await loadWindowState()

  // Create the main window
  mainWindow = createWindow()

  // Register IPC handlers once (handlers use a mutable window ref internally)
  registerIpcHandlers(mainWindow, configManager, indexer)

  // Validate existing photo paths and clean up dead entries
  const removed = await indexer.validatePaths()
  if (removed > 0) {
    console.log(`Cleaned up ${removed} missing photo entries`)
  }

  // Auto-scan on startup if configured
  const config = await configManager.load()
  if (config.scanOnStartup && config.folders.length > 0) {
    // Notify renderer to start scan via the scan:start IPC channel
    // The renderer will pick this up on load
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow!.webContents.send('startup:scan')
      })
    }
  }
})

// macOS: re-create window when dock icon is clicked and no other windows are open
app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    cachedWindowState = await loadWindowState()
    mainWindow = createWindow()
    // Update the window reference so IPC handlers target the new window
    setMainWindow(mainWindow)
  }
})

// Quit when window is closed
app.on('window-all-closed', () => {
  app.quit()
})

// Prevent WASM Aborted() from killing the process silently
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[main] Unhandled rejection:', err)
})
