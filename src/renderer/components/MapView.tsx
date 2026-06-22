import React, { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapViewProps {
  onPhotoClick: (photo: Photo) => void
}

// ─── WGS-84 → GCJ-02 coordinate conversion ──────────────────────────
// AMap tiles use GCJ-02 (China national security offset), while EXIF GPS
// stores WGS-84. This converts so markers land on the correct road/location.

const PI = Math.PI
const A = 6378245.0 // Semi-major axis
const EE = 0.00669342162296594323 // Eccentricity squared

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}

function wgs84ToGcj02(lat: number, lng: number): [number, number] {
  if (outOfChina(lat, lng)) return [lat, lng]

  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)

  return [lat + dLat, lng + dLng]
}

// ─── Components ──────────────────────────────────────────────────────

/** Sub-component that auto-fits the map bounds to all markers */
function FitBounds({ positions }: { positions: L.LatLngExpression[] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (positions.length > 0 && !fitted.current) {
      const bounds = L.latLngBounds(positions as L.LatLng[])
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      fitted.current = true
    }
  }, [positions, map])

  return null
}

/** Create a thumbnail marker icon using picora-asset protocol */
function createThumbIcon(thumbUrl: string): L.DivIcon {
  return L.divIcon({
    className: 'map-thumb-marker',
    html: `<div class="map-thumb-img-wrapper">
             <img src="${thumbUrl}" class="map-thumb-img" alt="" loading="lazy" />
           </div>`,
    iconSize: [64, 64],
    iconAnchor: [32, 32]
  })
}

/** Fallback dot marker for photos whose thumbnails are not yet generated */
const DOT_ICON = L.divIcon({
  className: 'map-dot-marker',
  html: '<div class="map-dot"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
})

interface MapPhoto extends Photo {
  thumbUrl: string | null
}

const MapView: React.FC<MapViewProps> = ({ onPhotoClick }) => {
  const [mapPhotos, setMapPhotos] = useState<MapPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [thumbProgress, setThumbProgress] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const result = await window.picora.getPhotosWithLocation()

        // Generate thumbnails on demand via getThumbnailPath (same as PhotoGrid)
        const enriched: MapPhoto[] = []
        for (let i = 0; i < result.length; i++) {
          if (cancelled) break
          const photo = result[i]
          const thumbPath = await window.picora.getThumbnailPath(photo.id)
          const thumbUrl = thumbPath
            ? `picora-asset://localhost${thumbPath}`
            : null
          enriched.push({ ...photo, thumbUrl })
          // Update progress every 10 photos
          if (i % 10 === 0) {
            setThumbProgress(`正在生成缩略图 ${i + 1}/${result.length}`)
          }
        }
        if (!cancelled) setMapPhotos(enriched)
      } catch (err) {
        console.error('加载地图照片失败：', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Convert WGS-84 (EXIF GPS) → GCJ-02 (AMap coordinate system)
  const positions = useMemo(
    () =>
      mapPhotos
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => wgs84ToGcj02(p.latitude!, p.longitude!) as L.LatLngExpression),
    [mapPhotos]
  )

  if (loading) {
    return (
      <div className="map-loading">
        <div className="loading-spinner" />
        <p>{thumbProgress || '正在加载地图数据…'}</p>
      </div>
    )
  }

  if (mapPhotos.length === 0) {
    return (
      <div className="map-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <p>没有包含地理位置的照片</p>
        <p className="subtext">拍摄时开启了 GPS 定位的照片会显示在地图上</p>
      </div>
    )
  }

  // Default center: first photo's converted location, or China center
  const center: L.LatLngExpression = positions.length > 0
    ? positions[0]
    : [35, 105]

  return (
    <div className="map-container">
      <MapContainer
        center={center}
        zoom={4}
        className="map-leaflet"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; 高德地图'
          url="https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=7"
          subdomains={['1', '2', '3', '4']}
        />
        <FitBounds positions={positions} />
        {mapPhotos.map((photo) => {
          if (photo.latitude == null || photo.longitude == null) return null
          const [gcjLat, gcjLng] = wgs84ToGcj02(photo.latitude, photo.longitude)
          return (
            <Marker
              key={photo.id}
              position={[gcjLat, gcjLng]}
              icon={photo.thumbUrl ? createThumbIcon(photo.thumbUrl) : DOT_ICON}
              eventHandlers={{
                click: () => onPhotoClick(photo)
              }}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}

export default MapView
