import { shell } from 'electron'

/**
 * Moves a photo to the system recycle bin / trash.
 * Returns true on success, false on failure.
 */
export async function deletePhoto(photoPath: string): Promise<boolean> {
  try {
    await shell.trashItem(photoPath)
    return true
  } catch {
    return false
  }
}
