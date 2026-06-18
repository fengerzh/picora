import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { createCanvas, Image as CanvasImage } from '@napi-rs/canvas'
import type { FaceData, Person, Photo } from './indexer'

// Use WASM build (no native compilation needed)
// @ts-ignore - face-api doesn't have proper types
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js')
// @ts-ignore
const tf = require('@tensorflow/tfjs')

let modelsLoaded = false

/**
 * Load face-api models from the models directory.
 */
export async function loadFaceModels(modelsPath: string): Promise<void> {
  if (modelsLoaded) return

  // Monkey-patch canvas for Node.js environment
  const { ImageData } = require('@napi-rs/canvas')
  faceapi.env.monkeyPatch({
    Canvas: class FakeCanvas {
      constructor(width: number = 1, height: number = 1) {
        return createCanvas(width, height)
      }
    },
    Image: CanvasImage,
    ImageData
  })

  // Set WASM backend path
  const tfjsWasm = require('@tensorflow/tfjs-backend-wasm')
  const wasmPath = path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/dist/tf-backend-wasm.node.js'))
  tfjsWasm.setWasmPaths(wasmPath + '/')

  // Initialize WASM backend before loading models
  await tf.setBackend('wasm')
  await tf.ready()

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath)
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath)
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)

  modelsLoaded = true
  console.log('[face-scan] Models loaded from', modelsPath)
}

interface ScanResult {
  faces: FaceData[]
}

/**
 * Detect faces in a photo and extract 128-dim embeddings.
 * Uses sharp to decode any image format into raw RGB pixels, then wraps as Tensor3D.
 * Images are resized to max 800px to avoid WASM memory crashes.
 */
export async function scanPhoto(photoPath: string): Promise<ScanResult> {
  const imgBuffer = await fs.promises.readFile(photoPath)

  // Check magic bytes to skip non-image files early
  if (imgBuffer.length < 4) {
    throw new Error('File too small to be an image')
  }
  const magic = imgBuffer.slice(0, 4)
  const isJPEG = magic[0] === 0xff && magic[1] === 0xd8
  const isPNG = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47
  const isWEBP = magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46 // RIFF
  const isGIF = magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46 // GIF
  const isBMP = magic[0] === 0x42 && magic[1] === 0x4d // BM
  const isTIFF = (magic[0] === 0x49 && magic[1] === 0x49) || (magic[0] === 0x4d && magic[1] === 0x4d) // II or MM
  const isHEIC = imgBuffer.length >= 12 && imgBuffer.slice(4, 12).toString('ascii').includes('ftyp')

  if (!isJPEG && !isPNG && !isWEBP && !isGIF && !isBMP && !isTIFF && !isHEIC) {
    throw new Error(`Unsupported image format (magic: ${magic.toString('hex')})`)
  }

  // Decode and resize image using sharp (supports JPEG, PNG, HEIC, etc.)
  // Max 800px to avoid WASM backend memory crashes
  const MAX_SIZE = 800
  const resized = await sharp(imgBuffer)
    .rotate() // auto-orient based on EXIF
    .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data: rawPixels, info } = resized
  const { width, height } = info

  // Create Tensor3D as float32 (face-api expects this)
  const tensor = tf.tidy(() =>
    tf.tensor3d(rawPixels, [height, width, 3]).toFloat()
  )

  let detections: any[]
  try {
    detections = await faceapi
      .detectAllFaces(tensor)
      .withFaceLandmarks()
      .withFaceDescriptors()
  } finally {
    tensor.dispose()
  }

  const faces: FaceData[] = detections.map((d: any) => {
    const box = d.detection.box
    return {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      embedding: Array.from(d.descriptor as Float32Array)
    }
  })

  return { faces }
}

/**
 * Euclidean distance between two face descriptors.
 * face-api.js uses 128-dim descriptors where distance < 0.6 typically means same person.
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/**
 * Cluster all face embeddings into persons.
 * Uses greedy clustering: a face joins a cluster if it's within distance threshold
 * of ANY face already in that cluster (not the average, to prevent drift).
 *
 * @param photos All photos with face data
 * @param maxDistance Distance threshold (lower = stricter, 0.6 is face-api default)
 * @returns Map of personId → array of {photoId, faceIndex}
 */
export function clusterFaces(
  photos: Photo[],
  maxDistance = 0.5
): Map<string, { photoId: string; faceIndex: number }[]> {
  // Collect all faces with their photo context
  interface FaceEntry {
    photoId: string
    faceIndex: number
    embedding: number[]
  }
  const allFaces: FaceEntry[] = []
  for (const photo of photos) {
    if (!photo.faces) continue
    for (let i = 0; i < photo.faces.length; i++) {
      allFaces.push({
        photoId: photo.id,
        faceIndex: i,
        embedding: photo.faces[i].embedding
      })
    }
  }

  // Greedy clustering: assign each face to the first cluster where
  // it's within maxDistance of ANY member (not average, to prevent drift)
  const clusters: { embeddings: number[][]; members: FaceEntry[] }[] = []

  for (const face of allFaces) {
    let assigned = false
    for (const cluster of clusters) {
      // Check against ALL members, not just the average
      let bestDist = Infinity
      for (const emb of cluster.embeddings) {
        const dist = euclideanDistance(face.embedding, emb)
        if (dist < bestDist) bestDist = dist
      }
      if (bestDist <= maxDistance) {
        cluster.embeddings.push(face.embedding)
        cluster.members.push(face)
        assigned = true
        break
      }
    }
    if (!assigned) {
      clusters.push({
        embeddings: [[...face.embedding]],
        members: [face]
      })
    }
  }

  // Build result map
  const result = new Map<string, { photoId: string; faceIndex: number }[]>()
  const timestamp = Date.now()
  clusters.forEach((cluster, idx) => {
    const personId = `person_${timestamp}_${idx}_${Math.random().toString(36).slice(2, 8)}`
    result.set(
      personId,
      cluster.members.map((m) => ({ photoId: m.photoId, faceIndex: m.faceIndex }))
    )
  })

  return result
}

/**
 * Build Person objects from clusters and assign personIds to faces.
 */
export function buildPersons(
  photos: Photo[],
  clusters: Map<string, { photoId: string; faceIndex: number }[]>,
  existingPersons: Person[]
): { persons: Person[]; updatedPhotos: Photo[] } {
  const persons: Person[] = []
  const updatedPhotos = photos.map((p) => ({
    ...p,
    faces: p.faces?.map((f) => ({ ...f }))
  }))

  let clusterIdx = 0
  for (const [personId, members] of clusters) {
    // Use first member's photo as representative
    const representativePhotoId = members[0]?.photoId

    // Count unique photos (a person may appear multiple times in one photo)
    const uniquePhotoIds = new Set(members.map((m) => m.photoId))
    const photoCount = uniquePhotoIds.size

    // Try to match with existing person by checking if any member was already assigned
    let existingPerson: Person | undefined
    for (const member of members) {
      const photo = photos.find((p) => p.id === member.photoId)
      const face = photo?.faces?.[member.faceIndex]
      if (face?.personId) {
        existingPerson = existingPersons.find((p) => p.id === face.personId)
        if (existingPerson) break
      }
    }

    const person: Person = existingPerson
      ? { ...existingPerson, faceCount: photoCount, representativePhotoId }
      : {
          id: personId,
          name: undefined,
          faceCount: photoCount,
          representativePhotoId
        }

    persons.push(person)

    // Assign personId to faces in updatedPhotos
    for (const member of members) {
      const photo = updatedPhotos.find((p) => p.id === member.photoId)
      if (photo?.faces?.[member.faceIndex]) {
        photo.faces[member.faceIndex].personId = person.id
      }
    }

    clusterIdx++
  }

  // Sort persons by face count descending
  persons.sort((a, b) => b.faceCount - a.faceCount)

  return { persons, updatedPhotos }
}
