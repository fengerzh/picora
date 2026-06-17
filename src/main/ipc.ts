import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { scanFolders } from './scanner'
import { readExifBatch } from './exif'
import { generateThumbnailsBatch } from './thumbnail'
import { deletePhoto } from './trash'
import { ConfigManager } from './config'
import { PhotoIndexer, Photo } from './indexer'

// Mutable reference so handlers always point at the current window
let mainWindowRef: BrowserWindow | null = null

function getWindow(): BrowserWindow | null {
  return mainWindowRef
}

function getThumbDir(): string {
  return path.join(app.getPath('userData'), 'thumbnails')
}

function sendProgress(phase: string, done: number, total: number): void {
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('scan:progress', { phase, done, total })
  }
}

/**
 * Updates the BrowserWindow reference used by IPC handlers.
 * Call this whenever a new main window is created.
 */
export function setMainWindow(win: BrowserWindow): void {
  mainWindowRef = win
}

/**
 * Registers all IPC handlers. Should only be called once during app startup.
 * The handlers use a mutable window reference so they always target the current window.
 */
export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  configManager: ConfigManager,
  indexer: PhotoIndexer
): void {
  mainWindowRef = mainWindow

  // ─── Config ──────────────────────────────────────────────────────────────────

  ipcMain.handle('config:get', async () => {
    return configManager.load()
  })

  ipcMain.handle('config:save', async (_event, config) => {
    await configManager.save(config)
  })

  ipcMain.handle('config:exists', async () => {
    return configManager.exists()
  })

  // ─── Scan ────────────────────────────────────────────────────────────────────

  ipcMain.handle('scan:start', async () => {
    const config = await configManager.load()
    const folders = config.folders

    if (folders.length === 0) {
      return { photos: [], total: 0 }
    }

    // Phase 1: discover files
    sendProgress('scanning', 0, 0)
    const filePaths = await scanFolders(folders)

    sendProgress('scanning', filePaths.length, filePaths.length)

    // Phase 2: read EXIF data
    sendProgress('reading', 0, filePaths.length)
    const exifResults = await readExifBatch(filePaths)

    sendProgress('reading', exifResults.length, filePaths.length)

    // Phase 3: build Photo records and add to index
    const photos: Photo[] = exifResults.map((result) => ({
      id: indexer.generateId(result.path),
      path: result.path,
      dateTaken: result.dateTaken.toISOString(),
      width: result.width,
      height: result.height,
      thumbGenerated: false
    }))

    await indexer.addPhotos(photos)

    // Phase 4: generate thumbnails in background (don't block the IPC response)
    const thumbDir = getThumbDir()
    const photosForThumbs = photos.map((p) => ({ path: p.path, id: p.id }))

    generateThumbnailsBatch(photosForThumbs, thumbDir, config.thumbnailSize, (done, total) => {
      sendProgress('thumbnails', done, total)
    }).then(async () => {
      // Mark thumbnails as generated in the index so the renderer knows to load them
      await indexer.markThumbnailsGenerated(photosForThumbs.map((p) => p.id))
      // Notify renderer to refresh photo data
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('photos:updated')
      }
    }).catch((err) => {
      console.error('Thumbnail generation failed:', err)
    })

    return { photos, total: photos.length }
  })

  // ─── Photos ──────────────────────────────────────────────────────────────────

  ipcMain.handle('photos:get', async (_event, page: number, pageSize: number) => {
    return indexer.getPhotos(page, pageSize)
  })

  ipcMain.handle('photos:count', async () => {
    return indexer.getPhotoCount()
  })

  ipcMain.handle('photos:byMonth', async () => {
    const groups = indexer.getByMonth()
    // Transform Record<string, Photo[]> → MonthData[] expected by renderer
    const yearMap: Record<number, Record<number, number>> = {}
    for (const [key, photos] of Object.entries(groups)) {
      const [y, m] = key.split('-').map(Number)
      if (!yearMap[y]) yearMap[y] = {}
      yearMap[y][m] = photos.length
    }
    return Object.entries(yearMap)
      .map(([year, months]) => ({
        year: Number(year),
        months: Object.entries(months)
          .map(([month, count]) => ({ month: Number(month), count }))
          .sort((a, b) => b.month - a.month) // newest month first
      }))
      .sort((a, b) => b.year - a.year) // newest year first
  })

  // ─── Thumbnail ───────────────────────────────────────────────────────────────

  ipcMain.handle('thumbnail:get', async (_event, photoId: string) => {
    const thumbPath = path.join(getThumbDir(), `${photoId}.webp`)
    try {
      await fs.access(thumbPath)
      return thumbPath
    } catch {
      return null
    }
  })

  // ─── Photo detail ────────────────────────────────────────────────────────────

  ipcMain.handle('photo:fullPath', async (_event, photoId: string) => {
    const photo = indexer.getPhotoById(photoId)
    return photo?.path ?? null
  })

  ipcMain.handle('photo:delete', async (_event, photoId: string) => {
    const photo = indexer.getPhotoById(photoId)

    if (!photo) {
      return false
    }

    // Move original file to system trash
    const deleted = await deletePhoto(photo.path)
    if (!deleted) {
      return false
    }

    // Remove from index
    await indexer.removePhoto(photoId)

    // Remove thumbnail file
    const thumbPath = path.join(getThumbDir(), `${photoId}.webp`)
    try {
      await fs.unlink(thumbPath)
    } catch {
      // Thumbnail may not exist — ignore
    }

    // Notify renderer that photos have changed
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('photos:updated')
    }

    return true
  })

  // ─── Folder selection ────────────────────────────────────────────────────────

  ipcMain.handle('folder:select', async () => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })
}
