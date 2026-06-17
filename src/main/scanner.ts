import * as fs from 'fs/promises'
import * as path from 'path'

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.heic', '.heif',
  '.webp', '.bmp', '.tiff', '.tif'
])

/**
 * Recursively scans the given folders for image files with supported extensions.
 * Returns an array of absolute file paths.
 */
export async function scanFolders(folders: string[]): Promise<string[]> {
  const results: string[] = []

  async function walk(dir: string): Promise<void> {
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      // Skip folders that can't be read (permission denied, missing, etc.)
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          results.push(fullPath)
        }
      }
    }
  }

  for (const folder of folders) {
    await walk(folder)
  }

  return results
}
