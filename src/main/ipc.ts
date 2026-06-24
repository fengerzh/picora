import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { scanFolders } from './scanner'
import { readExifBatch } from './exif'
import { getOrGenerateThumbnail } from './thumbnail'
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
      thumbGenerated: false,
      latitude: result.latitude,
      longitude: result.longitude,
      make: result.make,
      model: result.model,
      fNumber: result.fNumber,
      exposureTime: result.exposureTime,
      iso: result.iso,
      focalLength: result.focalLength
    }))

    await indexer.addPhotos(photos)

    // Thumbnails are now generated on-demand when photos come into view
    // (see thumbnail:get handler below)

    return { photos, total: photos.length }
  })

  // ─── Photos ──────────────────────────────────────────────────────────────────

  ipcMain.handle('photos:all', async () => {
    return indexer.getAllPhotos()
  })

  ipcMain.handle('photos:withLocation', async () => {
    return indexer.getAllPhotos().filter(
      (p) => p.latitude != null && p.longitude != null
    )
  })

  ipcMain.handle('photos:get', async (_event, page: number, pageSize: number) => {
    return indexer.getPhotos(page, pageSize)
  })

  ipcMain.handle('photos:count', async () => {
    return indexer.getPhotoCount()
  })

  ipcMain.handle('photos:byMonth', async () => {
    return indexer.getMonthCounts()
  })

  // ─── Thumbnail ───────────────────────────────────────────────────────────────

  ipcMain.handle('thumbnail:get', async (_event, photoId: string) => {
    const photo = indexer.getPhotoById(photoId)
    if (!photo) return null

    const config = await configManager.load()
    const thumbPath = await getOrGenerateThumbnail(
      photoId,
      photo.path,
      getThumbDir(),
      config.thumbnailSize
    )

    // Mark as generated so the renderer knows to display it
    if (thumbPath && !photo.thumbGenerated) {
      await indexer.markThumbnailsGenerated([photoId])
    }

    return thumbPath
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

  // ─── Favorites ───────────────────────────────────────────────────────────────

  ipcMain.handle('photo:toggleFavorite', async (_event, photoId: string) => {
    return indexer.toggleFavorite(photoId)
  })

  ipcMain.handle('photos:favorites', async () => {
    return indexer.getFavorites()
  })

  // ─── Face Recognition ────────────────────────────────────────────────────────

  let faceScanRunning = false
  let faceScanCancelled = false

  // Start face scan (batch + resumable)
  ipcMain.handle('face-scan:start', async () => {
    if (faceScanRunning) return { error: 'already running' }
    faceScanRunning = true
    faceScanCancelled = false

    try {
      // Load models
      const modelsPath = app.isPackaged
        ? path.join(process.resourcesPath, 'models')
        : path.join(__dirname, '../../resources/models')

      const { loadFaceModels, scanPhoto, clusterFaces, buildPersons } = require('./faceScan')
      await loadFaceModels(modelsPath)

      const unscanned = indexer.getUnscannedPhotos()
      const total = unscanned.length
      let done = 0
      const BATCH_SIZE = 10

      for (let i = 0; i < unscanned.length; i += BATCH_SIZE) {
        if (faceScanCancelled) break

        const batch = unscanned.slice(i, i + BATCH_SIZE)
        for (const photo of batch) {
          if (faceScanCancelled) break

          // Skip non-image files by extension
          const ext = path.extname(photo.path).toLowerCase()
          const supportedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.heic', '.heif', '.avif']
          if (!supportedExts.includes(ext)) {
            try { await indexer.updatePhotoFaces(photo.id, []) } catch {}
            done++
            sendProgress('face-scan', done, total)
            continue
          }

          try {
            const result = await scanPhoto(photo.path)
            try { await indexer.updatePhotoFaces(photo.id, result.faces) } catch (e) {
              console.error(`[face-scan] Failed to save faces for ${photo.path}:`, e)
            }
          } catch (err) {
            // Silently skip unsupported/broken files
            // Mark as done to skip them next time
            try { await indexer.updatePhotoFaces(photo.id, []) } catch (e) {}
          }
          done++
          sendProgress('face-scan', done, total)
        }

        // Yield to event loop between batches
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      // Re-cluster all faces
      if (!faceScanCancelled) {
        const allPhotos = indexer.getIndex()
        const clusters = clusterFaces(allPhotos, 0.5)
        const existingPersons = indexer.getPersons()
        const { persons, updatedPhotos } = buildPersons(allPhotos, clusters, existingPersons)
        await indexer.updatePersons(persons)
        // Update photo faces with personIds
        for (const photo of updatedPhotos) {
          if (photo.faces) {
            await indexer.updatePhotoFaces(photo.id, photo.faces)
          }
        }
      }

      faceScanRunning = false
      return { done, total, cancelled: faceScanCancelled }
    } catch (err) {
      faceScanRunning = false
      console.error('[face-scan] Fatal error:', err)
      return { error: String(err) }
    }
  })

  // Cancel face scan
  ipcMain.handle('face-scan:cancel', async () => {
    faceScanCancelled = true
    return true
  })

  // Get face scan status
  ipcMain.handle('face-scan:status', async () => {
    const unscanned = indexer.getUnscannedPhotos()
    const total = indexer.getIndex().length
    return {
      scanned: total - unscanned.length,
      total,
      running: faceScanRunning
    }
  })

  // Reset face scan status (force re-scan all photos)
  ipcMain.handle('face-scan:reset', async () => {
    await indexer.resetFaceScan()
    return true
  })

  // Get all persons
  ipcMain.handle('persons:list', async () => {
    return indexer.getPersons()
  })

  // Rename a person
  ipcMain.handle('person:rename', async (_event, personId: string, name: string) => {
    await indexer.renamePerson(personId, name)
    return true
  })

  // Get photos by person
  ipcMain.handle('person:photos', async (_event, personId: string) => {
    return indexer.getPhotosByPerson(personId)
  })
}
