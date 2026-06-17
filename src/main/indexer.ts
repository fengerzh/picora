import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

export interface Photo {
  id: string
  path: string
  dateTaken: string // ISO string
  width: number
  height: number
  thumbGenerated: boolean
}

export interface PhotoIndex {
  version: number
  lastScan: string
  folders: string[]
  photos: Photo[]
}

function emptyIndex(): PhotoIndex {
  return {
    version: 1,
    lastScan: new Date().toISOString(),
    folders: [],
    photos: []
  }
}

export class PhotoIndexer {
  private readonly indexPath: string
  private index: PhotoIndex = emptyIndex()

  constructor(userDataPath: string) {
    this.indexPath = path.join(userDataPath, 'photos.json')
  }

  /**
   * Loads the index from disk, or returns an empty index if the file doesn't exist.
   */
  async load(): Promise<PhotoIndex> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8')
      this.index = JSON.parse(data) as PhotoIndex
    } catch {
      this.index = emptyIndex()
    }
    return this.index
  }

  /**
   * Persists the current index to disk.
   */
  async save(index: PhotoIndex): Promise<void> {
    this.index = index
    await fs.mkdir(path.dirname(this.indexPath), { recursive: true })
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8')
  }

  /**
   * Adds new photos to the index (skips duplicates by id), then saves.
   */
  async addPhotos(photos: Photo[]): Promise<void> {
    const existingIds = new Set(this.index.photos.map((p) => p.id))
    const newPhotos = photos.filter((p) => !existingIds.has(p.id))
    this.index.photos.push(...newPhotos)
    this.index.lastScan = new Date().toISOString()
    await this.save(this.index)
  }

  /**
   * Removes a photo by id. Returns true if found and removed.
   */
  async removePhoto(id: string): Promise<boolean> {
    const before = this.index.photos.length
    this.index.photos = this.index.photos.filter((p) => p.id !== id)
    if (this.index.photos.length !== before) {
      await this.save(this.index)
      return true
    }
    return false
  }

  /**
   * Validates that every photo path still exists on disk.
   * Removes dead entries and saves. Returns the number of removed entries.
   */
  async validatePaths(): Promise<number> {
    const alive: Photo[] = []
    let removedCount = 0

    for (const photo of this.index.photos) {
      try {
        await fs.access(photo.path)
        alive.push(photo)
      } catch {
        removedCount++
      }
    }

    if (removedCount > 0) {
      this.index.photos = alive
      await this.save(this.index)
    }

    return removedCount
  }

  /**
   * Generates a stable short MD5-based id for a file path.
   */
  generateId(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex').slice(0, 8)
  }

  /**
   * Returns photos sorted by dateTaken descending, paginated.
   */
  getPhotos(page: number, pageSize: number): { photos: Photo[]; total: number } {
    const sorted = [...this.index.photos].sort(
      (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
    )
    const start = (page - 1) * pageSize
    const paged = sorted.slice(start, start + pageSize)
    return { photos: paged, total: sorted.length }
  }

  /**
   * Returns the total number of indexed photos.
   */
  getPhotoCount(): number {
    return this.index.photos.length
  }

  /**
   * Looks up a single photo by its id.
   */
  getPhotoById(id: string): Photo | undefined {
    return this.index.photos.find((p) => p.id === id)
  }

  /**
   * Marks the given photo IDs as having thumbnails generated, then saves.
   */
  async markThumbnailsGenerated(ids: string[]): Promise<void> {
    const idSet = new Set(ids)
    for (const photo of this.index.photos) {
      if (idSet.has(photo.id)) {
        photo.thumbGenerated = true
      }
    }
    await this.save(this.index)
  }

  /**
   * Groups photos by year-month (e.g. "2024-03") for the time tree view.
   * Returns a map of "YYYY-MM" → Photo[].
   */
  getByMonth(): Record<string, Photo[]> {
    const groups: Record<string, Photo[]> = {}

    for (const photo of this.index.photos) {
      const d = new Date(photo.dateTaken)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(photo)
    }

    // Sort each group by dateTaken descending
    for (const key of Object.keys(groups)) {
      groups[key].sort(
        (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime()
      )
    }

    return groups
  }
}
