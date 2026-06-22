import React, { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapViewProps {
  onPhotoClick: (photo: Photo) => void
}

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
function createThumbIcon(photo: Photo): L.DivIcon {
  const thumbPath = `/thumbnails/${photo.id}.webp`
  const url = `picora-asset://localhost${thumbPath}`

  return L.divIcon({
    className: 'map-thumb-marker',
    html: `<div class="map-thumb-img-wrapper">
             <img src="${url}" class="map-thumb-img" alt="" loading="lazy" />
           </div>`,
    iconSize: [64, 64],
    iconAnchor: [32, 32]
  })
}

const MapView: React.FC<MapViewProps> = ({ onPhotoClick }) => {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const result = await window.picora.getPhotosWithLocation()
        if (!cancelled) setPhotos(result)
      } catch (err) {
        console.error('加载地图照片失败：', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const positions = useMemo(
    () =>
      photos
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => [p.latitude!, p.longitude!] as L.LatLngExpression),
    [photos]
  )

  if (loading) {
    return (
      <div className="map-loading">
        <div className="loading-spinner" />
        <p>正在加载地图数据…</p>
      </div>
    )
  }

  if (photos.length === 0) {
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

  // Default center: first photo's location, or world view
  const center: L.LatLngExpression = positions.length > 0
    ? positions[0]
    : [30, 110]

  return (
    <div className="map-container">
      <MapContainer
        center={center}
        zoom={3}
        className="map-leaflet"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />
        {photos.map((photo) => {
          if (photo.latitude == null || photo.longitude == null) return null
          return (
            <Marker
              key={photo.id}
              position={[photo.latitude, photo.longitude]}
              icon={createThumbIcon(photo)}
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
