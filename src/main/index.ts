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

async function ensureThumbDir(): Promise<void> {
  const thumbDir = path.join(app.getPath('userData'), 'thumbnails')
  await fs.mkdir(thumbDir, { recursive: true })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Picora',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

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
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
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
