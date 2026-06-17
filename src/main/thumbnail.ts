import sharp from 'sharp'
import * as path from 'path'
import * as fs from 'fs/promises'

/**
 * Generates a WebP thumbnail for a single image.
 * Returns true on success, false on failure.
 */
export async function generateThumbnail(
  inputPath: string,
  outputPath: string,
  size: number
): Promise<boolean> {
  try {
    await sharp(inputPath)
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(outputPath)
    return true
  } catch {
    return false
  }
}

/**
 * Generates thumbnails for a batch of photos.
 * Processes in groups of 50 and reports progress via the onProgress callback.
 */
export async function generateThumbnailsBatch(
  photos: Array<{ path: string; id: string }>,
  thumbDir: string,
  size: number,
  onProgress: (done: number, total: number) => void
): Promise<void> {
  const BATCH_SIZE = 50
  const total = photos.length
  let done = 0

  // Ensure thumbnail directory exists
  await fs.mkdir(thumbDir, { recursive: true })

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (photo) => {
        const outputPath = path.join(thumbDir, `${photo.id}.webp`)
        await generateThumbnail(photo.path, outputPath, size)
      })
    )

    done += batch.length
    onProgress(done, total)
  }
}
